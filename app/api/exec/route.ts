import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import { expandHomeDir } from '@/lib/server-fs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { command, pythonBinary, pipPackages } = body;
  const expandedRoot = typeof body.comfyRoot === 'string' ? expandHomeDir(body.comfyRoot) : '';

  const cwd = expandedRoot && fs.existsSync(expandedRoot) ? expandedRoot : process.cwd();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const sendLine = (type: 'stdout' | 'stderr' | 'info' | 'success', text: string) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify({ type, text }) + '\n'));
        } catch {
          // stream already closed
        }
      };

      let child;
      if (Array.isArray(pipPackages) && pipPackages.length > 0) {
        const py = typeof pythonBinary === 'string' && pythonBinary.trim()
          ? expandHomeDir(pythonBinary)
          : 'python';
        const args = ['-m', 'pip', 'install', ...pipPackages];
        sendLine('info', `Executing: ${py} ${args.join(' ')}`);
        child = spawn(py, args, { cwd, shell: false });
      } else if (typeof command === 'string' && command.trim()) {
        sendLine('info', `Executing in ${cwd}: ${command.trim()}`);
        child = spawn(command.trim(), { cwd, shell: true });
      } else {
        sendLine('stderr', 'No command or pipPackages provided.');
        controller.close();
        return;
      }

      const onAbort = () => {
        try {
          child.kill();
          sendLine('stderr', 'Process aborted by user.');
        } catch {
          // ignore
        }
      };
      req.signal.addEventListener('abort', onAbort);

      child.stdout?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString('utf-8').split(/\r?\n/);
        for (const line of lines) {
          if (line.trim()) sendLine('stdout', line);
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString('utf-8').split(/\r?\n/);
        for (const line of lines) {
          if (line.trim()) sendLine('stderr', line);
        }
      });

      child.on('error', (err) => {
        sendLine('stderr', `Process error: ${err.message}`);
        req.signal.removeEventListener('abort', onAbort);
        try {
          controller.close();
        } catch {
          // ignore
        }
      });

      child.on('close', (code) => {
        req.signal.removeEventListener('abort', onAbort);
        if (code === 0) {
          sendLine('success', `Process finished cleanly with exit code 0.`);
        } else {
          sendLine('stderr', `Process exited with code ${code ?? 'unknown'}.`);
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
