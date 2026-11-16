import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { expandHomeDir } from '@/lib/server-fs';

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    timeout: 30000,
  });
  return stdout.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: 'status' | 'update' = body.action === 'update' ? 'update' : 'status';
    const rawRoot = typeof body.comfyRoot === 'string' ? body.comfyRoot : '';
    const resolvedRoot = expandHomeDir(rawRoot);

    if (!resolvedRoot || !fs.existsSync(path.join(resolvedRoot, 'main.py'))) {
      return NextResponse.json(
        { error: 'Valid ComfyUI root directory is required' },
        { status: 400 }
      );
    }

    if (!fs.existsSync(path.join(resolvedRoot, '.git'))) {
      return NextResponse.json({
        isGitRepo: false,
        branch: null,
        commit: null,
        behindCount: 0,
        hasUpdate: false,
        message: 'No .git repository found in ComfyUI root (portable snapshot install).',
      });
    }

    if (action === 'update') {
      const previousCommit = await runGit(resolvedRoot, ['rev-parse', '--short', 'HEAD']);
      const pullOutput = await runGit(resolvedRoot, ['pull', '--ff-only']);
      const currentCommit = await runGit(resolvedRoot, ['rev-parse', '--short', 'HEAD']);
      const branch = await runGit(resolvedRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);

      return NextResponse.json({
        isGitRepo: true,
        branch,
        previousCommit,
        commit: currentCommit,
        behindCount: 0,
        hasUpdate: false,
        updated: previousCommit !== currentCommit,
        message: pullOutput || 'ComfyUI Core is up to date.',
      });
    }

    const branch = await runGit(resolvedRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const commit = await runGit(resolvedRoot, ['rev-parse', '--short', 'HEAD']);

    let behindCount = 0;
    try {
      await runGit(resolvedRoot, ['fetch', '--quiet']);
      const countStr = await runGit(resolvedRoot, ['rev-list', '--count', 'HEAD..@{u}']);
      behindCount = Number.parseInt(countStr, 10) || 0;
    } catch {
      behindCount = 0;
    }

    return NextResponse.json({
      isGitRepo: true,
      branch,
      commit,
      behindCount,
      hasUpdate: behindCount > 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to inspect ComfyUI Core' },
      { status: 500 }
    );
  }
}
