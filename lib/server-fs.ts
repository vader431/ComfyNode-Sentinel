import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Ensures a target path is strictly inside a permitted base directory.
 */
export function resolveSafeSubpath(baseDir: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, ...segments);
  const rel = path.relative(resolvedBase, resolvedTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Security error: Path traversal detected (${resolvedTarget})`);
  }
  return resolvedTarget;
}

/**
 * Expands leading "~" to the current OS user's home directory.
 */
export function expandHomeDir(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (trimmed === '~') {
    return os.homedir();
  }
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

/**
 * Returns OS-appropriate candidate preset paths and probes which ones exist on disk.
 */
export function detectHostComfyCandidates(): {
  platform: NodeJS.Platform;
  arch: string;
  presetPaths: string[];
  detectedPaths: string[];
} {
  const home = os.homedir();
  const isWin = process.platform === 'win32';
  const presetPaths = isWin
    ? [
        'C:\\AI\\ComfyUI_windows_portable\\ComfyUI',
        'C:\\ComfyUI',
        'D:\\ComfyUI',
        path.join(home, 'ComfyUI'),
      ]
    : [
        path.join(home, 'ComfyUI'),
        path.join(home, 'AI', 'ComfyUI'),
        '/workspace/ComfyUI',
        path.join(process.cwd(), 'ComfyUI'),
      ];

  const detectedPaths = presetPaths.filter((candidate) => {
    try {
      return (
        fs.existsSync(candidate) &&
        fs.existsSync(path.join(candidate, 'main.py')) &&
        fs.existsSync(path.join(candidate, 'custom_nodes'))
      );
    } catch {
      return false;
    }
  });

  return {
    platform: process.platform,
    arch: process.arch,
    presetPaths,
    detectedPaths,
  };
}

export async function validateComfyEnvironment(
  comfyRoot: string,
  requestedPython?: string
) {
  const trimmedRoot = expandHomeDir(comfyRoot);
  const expandedRequestedPython = requestedPython ? expandHomeDir(requestedPython) : undefined;

  if (!trimmedRoot) {
    return {
      isValidRoot: false,
      hasMainPy: false,
      hasCustomNodes: false,
      resolvedRoot: '',
      detectedPython: expandedRequestedPython || 'python',
      pythonVersion: '',
      pythonType: 'system' as const,
      platform: process.platform,
      arch: process.arch,
      error: 'ComfyUI root path is empty.',
    };
  }

  const rootExists = fs.existsSync(trimmedRoot);
  const hasMainPy = rootExists && fs.existsSync(path.join(trimmedRoot, 'main.py'));
  const hasCustomNodes = rootExists && fs.existsSync(path.join(trimmedRoot, 'custom_nodes'));
  const isValidRoot = hasMainPy && hasCustomNodes;

  // Detect Python binary
  const candidates: { bin: string; type: 'windows_portable' | 'virtualenv' | 'system' }[] = [];
  if (expandedRequestedPython) {
    candidates.push({ bin: expandedRequestedPython, type: 'system' });
  }

  const parentDir = path.dirname(trimmedRoot);
  candidates.push(
    { bin: path.join(parentDir, 'python_embeded', 'python.exe'), type: 'windows_portable' },
    { bin: path.join(trimmedRoot, 'venv', 'Scripts', 'python.exe'), type: 'virtualenv' },
    { bin: path.join(trimmedRoot, '.venv', 'Scripts', 'python.exe'), type: 'virtualenv' },
    { bin: path.join(trimmedRoot, 'venv', 'bin', 'python'), type: 'virtualenv' },
    { bin: path.join(trimmedRoot, '.venv', 'bin', 'python'), type: 'virtualenv' },
    { bin: 'python3', type: 'system' },
    { bin: 'python', type: 'system' }
  );

  let detectedPython = expandedRequestedPython || 'python';
  let pythonVersion = '';
  let detectedType: 'windows_portable' | 'virtualenv' | 'system' | 'custom' = 'system';

  for (const cand of candidates) {
    if (cand.bin.includes(path.sep) || cand.bin.includes('/')) {
      if (!fs.existsSync(cand.bin)) continue;
    }
    try {
      const { stdout, stderr } = await execFileAsync(cand.bin, ['--version'], {
        timeout: 4000,
      });
      const ver = (stdout || stderr || '').trim();
      if (ver.toLowerCase().includes('python')) {
        detectedPython = cand.bin;
        pythonVersion = ver;
        detectedType = cand.type;
        break;
      }
    } catch {
      // try next candidate
    }
  }

  return {
    isValidRoot,
    hasMainPy,
    hasCustomNodes,
    resolvedRoot: trimmedRoot,
    detectedPython,
    pythonVersion,
    pythonType: detectedType,
    platform: process.platform,
    arch: process.arch,
    error: isValidRoot
      ? undefined
      : !rootExists
        ? `Directory does not exist: ${trimmedRoot}`
        : 'Directory must contain both main.py and custom_nodes/.',
  };
}

/**
 * Computes fast folder size in MB and file count (skipping .git and __pycache__ for speed).
 */
export function getFolderStats(dirPath: string): { filesCount: number; sizeMb: number } {
  let filesCount = 0;
  let totalBytes = 0;

  const walk = (current: string, depth: number) => {
    if (depth > 5) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === '__pycache__' || entry.name === 'node_modules') {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile()) {
        filesCount++;
        try {
          totalBytes += fs.statSync(full).size;
        } catch {
          // ignore
        }
      }
    }
  };

  walk(dirPath, 0);
  return {
    filesCount,
    sizeMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
  };
}

/**
 * Collects up to maxFiles .py files inside a node directory (prioritizing root __init__.py).
 */
export function collectPythonFiles(dirPath: string, maxFiles = 20): string[] {
  const results: string[] = [];

  const initPy = path.join(dirPath, '__init__.py');
  if (fs.existsSync(initPy)) {
    results.push(initPy);
  }

  const walk = (current: string, depth: number) => {
    if (depth > 3 || results.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      if (entry.name.startsWith('.') || entry.name === '__pycache__' || entry.name === 'venv') {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.py') && full !== initPy) {
        results.push(full);
      }
    }
  };

  walk(dirPath, 0);
  return results;
}

/**
 * Parses NODE_CLASS_MAPPINGS dictionary keys and bracket assignments from Python node source.
 */
export function extractNodeClassesFromPython(code: string): string[] {
  const classes = new Set<string>();

  // Match NODE_CLASS_MAPPINGS = { "ClassName": ClassObj, ... }
  const dictBlockRegex = /NODE_CLASS_MAPPINGS\s*(?::[^=]+)?=\s*\{([\s\S]*?)\}/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = dictBlockRegex.exec(code)) !== null) {
    const body = blockMatch[1];
    const keyRegex = /['"]([A-Za-z0-9_.\-/ ]+)['"]\s*:/g;
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = keyRegex.exec(body)) !== null) {
      classes.add(keyMatch[1]);
    }
  }

  // Match NODE_CLASS_MAPPINGS["ClassName"] = ClassObj or .update({ ... })
  const subscriptRegex = /NODE_CLASS_MAPPINGS\s*\[\s*['"]([A-Za-z0-9_.\-/ ]+)['"]\s*\]\s*=/g;
  let subMatch: RegExpExecArray | null;
  while ((subMatch = subscriptRegex.exec(code)) !== null) {
    classes.add(subMatch[1]);
  }

  return Array.from(classes);
}

/**
 * Extracts repository owner/author from HTTPS or SSH git URL.
 */
export function extractGitOwner(gitUrl: string): string {
  const trimmed = (gitUrl || '').trim();
  if (!trimmed) return 'local';

  // SSH format: git@github.com:owner/repo.git
  const sshMatch = trimmed.match(/^git@[^:]+:([^/]+)\//i);
  if (sshMatch) return sshMatch[1];

  // HTTPS/HTTP format: https://github.com/owner/repo.git
  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) return parts[0];
  } catch {
    // fallback below
  }

  return 'local';
}

/**
 * Extracts git remote URL (preferring origin), branch, and short commit hash from .git/ directory.
 */
export function readGitMetadata(nodePath: string): {
  gitUrl: string;
  branch: string;
  currentCommit: string;
} {
  const gitDir = path.join(nodePath, '.git');
  let gitUrl = '';
  let branch = 'main';
  let currentCommit = '';

  if (!fs.existsSync(gitDir)) {
    return { gitUrl, branch, currentCommit };
  }

  try {
    const configPath = path.join(gitDir, 'config');
    if (fs.existsSync(configPath)) {
      const config = fs.readFileSync(configPath, 'utf-8');
      const originSection = config.match(/\[remote\s+"origin"\]([\s\S]*?)(?=\n\[|$)/);
      const originUrlMatch = originSection?.[1]?.match(/^\s*url\s*=\s*(.+)$/m);
      if (originUrlMatch) {
        gitUrl = originUrlMatch[1].trim();
      } else {
        const fallbackMatch = config.match(/^\s*url\s*=\s*(.+)$/m);
        if (fallbackMatch) {
          gitUrl = fallbackMatch[1].trim();
        }
      }
    }

    const headPath = path.join(gitDir, 'HEAD');
    if (fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, 'utf-8').trim();
      if (head.startsWith('ref: ')) {
        const refPath = head.slice(5).trim();
        branch = refPath.split('/').pop() || 'main';
        const fullRefPath = path.join(gitDir, refPath);
        if (fs.existsSync(fullRefPath)) {
          currentCommit = fs.readFileSync(fullRefPath, 'utf-8').trim().slice(0, 7);
        } else {
          const packedPath = path.join(gitDir, 'packed-refs');
          if (fs.existsSync(packedPath)) {
            const packed = fs.readFileSync(packedPath, 'utf-8');
            const refLine = packed.split('\n').find((l) => l.endsWith(refPath));
            if (refLine) {
              currentCommit = refLine.split(' ')[0].slice(0, 7);
            }
          }
        }
      } else {
        currentCommit = head.slice(0, 7);
        branch = 'detached';
      }
    }
  } catch {
    // ignore malformed git files
  }

  return { gitUrl, branch, currentCommit };
}

/**
 * Computes a fast partial SHA-256 fingerprint (size + first 64KB + last 64KB)
 * so multi-gigabyte .safetensors files can be deduplicated in milliseconds.
 */
export function computeFastFileFingerprint(filePath: string, sizeBytes: number): string {
  const hash = crypto.createHash('sha256');
  hash.update(String(sizeBytes));

  const chunkSize = 65536;
  const fd = fs.openSync(filePath, 'r');
  try {
    const headBuf = Buffer.alloc(Math.min(chunkSize, sizeBytes));
    fs.readSync(fd, headBuf, 0, headBuf.length, 0);
    hash.update(headBuf);

    if (sizeBytes > chunkSize) {
      const tailBuf = Buffer.alloc(Math.min(chunkSize, sizeBytes - chunkSize));
      const tailOffset = Math.max(chunkSize, sizeBytes - tailBuf.length);
      fs.readSync(fd, tailBuf, 0, tailBuf.length, tailOffset);
      hash.update(tailBuf);
    }
  } finally {
    fs.closeSync(fd);
  }

  return hash.digest('hex').slice(0, 16);
}
