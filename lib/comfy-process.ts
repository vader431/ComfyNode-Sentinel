import { ChildProcess, execFile, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { expandHomeDir } from '@/lib/server-fs';

export type ComfyProcessStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface ComfyProcessLogEntry {
  id: number;
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'info';
  text: string;
}

export interface ComfyProcessSnapshot {
  status: ComfyProcessStatus;
  pid: number | null;
  port: number;
  startedAt: string | null;
  exitCode: number | null;
  logs: ComfyProcessLogEntry[];
  lastLogId: number;
}

interface InternalProcessState {
  child: ChildProcess | null;
  pid: number | null;
  status: ComfyProcessStatus;
  port: number;
  startedAt: string | null;
  exitCode: number | null;
  logs: ComfyProcessLogEntry[];
  nextLogId: number;
}

const MAX_LOGS = 500;

declare global {
  var __comfyProcessState: InternalProcessState | undefined;
}

function getState(): InternalProcessState {
  if (!globalThis.__comfyProcessState) {
    globalThis.__comfyProcessState = {
      child: null,
      pid: null,
      status: 'stopped',
      port: 8188,
      startedAt: null,
      exitCode: null,
      logs: [],
      nextLogId: 1,
    };
  }
  return globalThis.__comfyProcessState;
}

function appendLog(stream: 'stdout' | 'stderr' | 'info', text: string) {
  const state = getState();
  const entry: ComfyProcessLogEntry = {
    id: state.nextLogId++,
    timestamp: new Date().toISOString(),
    stream,
    text,
  };
  state.logs.push(entry);
  if (state.logs.length > MAX_LOGS) {
    state.logs.splice(0, state.logs.length - MAX_LOGS);
  }
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 300);

    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}

export async function getComfyProcessStatus(sinceId = 0): Promise<ComfyProcessSnapshot> {
  const state = getState();
  if (state.status === 'starting' && state.child) {
    const listening = await isPortListening(state.port);
    if (listening) {
      state.status = 'running';
      appendLog('info', `ComfyUI web server is ready on http://127.0.0.1:${state.port}`);
    }
  }

  const logs = sinceId > 0 ? state.logs.filter((l) => l.id > sinceId) : [...state.logs];
  const lastLogId = state.logs.length > 0 ? state.logs[state.logs.length - 1].id : sinceId;

  return {
    status: state.status,
    pid: state.pid,
    port: state.port,
    startedAt: state.startedAt,
    exitCode: state.exitCode,
    logs,
    lastLogId,
  };
}

export async function startComfyProcess(
  comfyRoot: string,
  pythonBinary: string,
  port = 8188
): Promise<ComfyProcessSnapshot> {
  const state = getState();
  if (state.child && (state.status === 'starting' || state.status === 'running')) {
    return getComfyProcessStatus();
  }

  const resolvedRoot = expandHomeDir(comfyRoot);
  if (!resolvedRoot || !fs.existsSync(path.join(resolvedRoot, 'main.py'))) {
    throw new Error(`Invalid ComfyUI root: main.py not found in "${resolvedRoot}".`);
  }

  const py = pythonBinary?.trim() || 'python';
  const args = ['main.py', '--listen', '127.0.0.1', '--port', String(port)];

  state.logs = [];
  state.exitCode = null;
  state.port = port;
  state.startedAt = new Date().toISOString();
  state.status = 'starting';
  appendLog('info', `Starting ComfyUI (${py} ${args.join(' ')}) in ${resolvedRoot}`);

  const child = spawn(py, args, {
    cwd: resolvedRoot,
    shell: false,
    detached: process.platform !== 'win32',
  });

  state.child = child;
  state.pid = child.pid ?? null;

  child.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString('utf-8').split(/\r?\n/)) {
      if (line.trim()) appendLog('stdout', line);
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString('utf-8').split(/\r?\n/)) {
      if (line.trim()) appendLog('stderr', line);
    }
  });

  child.on('error', (err) => {
    state.status = 'error';
    state.child = null;
    state.pid = null;
    appendLog('stderr', `Failed to start ComfyUI: ${err.message}`);
  });

  child.on('close', (code) => {
    state.exitCode = code;
    state.child = null;
    state.pid = null;
    if (state.status !== 'error') {
      state.status = code === 0 || code === null ? 'stopped' : 'error';
    }
    appendLog('info', `ComfyUI process exited (code ${code ?? 'terminated'}).`);
  });

  return getComfyProcessStatus();
}

export async function stopComfyProcess(): Promise<ComfyProcessSnapshot> {
  const state = getState();
  const child = state.child;
  const pid = state.pid;

  if (!child || !pid) {
    state.status = 'stopped';
    state.child = null;
    state.pid = null;
    return getComfyProcessStatus();
  }

  appendLog('info', `Stopping ComfyUI process (PID ${pid})...`);

  await new Promise<void>((resolve) => {
    if (process.platform === 'win32') {
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => {
        resolve();
      });
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
      }
      resolve();
    }
  });

  state.status = 'stopped';
  state.child = null;
  state.pid = null;
  return getComfyProcessStatus();
}

export async function restartComfyProcess(
  comfyRoot: string,
  pythonBinary: string,
  port = 8188
): Promise<ComfyProcessSnapshot> {
  await stopComfyProcess();
  return startComfyProcess(comfyRoot, pythonBinary, port);
}

