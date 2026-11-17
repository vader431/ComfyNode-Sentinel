import { NextRequest, NextResponse } from 'next/server';
import { execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { expandHomeDir } from '@/lib/server-fs';
import {
  isValidGitRef,
  parseComfyVersionFromPyproject,
  parseComfyVersionFromPython,
  parseGitOnelineLog,
  parseGitProgressLine,
  type CoreCommitItem,
  type CoreReleaseItem,
} from '@/lib/core-updater';

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[], timeout = 30000): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    timeout,
  });
  return stdout.trim();
}

function runGitStreaming(
  cwd: string,
  args: string[],
  onProgress: (phase: string, percent: number) => void
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let stderrBuf = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stderr += text;
      stderrBuf += text;
      const parts = stderrBuf.split(/[\r\n]+/);
      stderrBuf = parts.pop() ?? '';
      for (const part of parts) {
        const parsed = parseGitProgressLine(part);
        if (parsed) {
          onProgress(parsed.phase, parsed.percent);
        }
      }
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (stderrBuf) {
        const parsed = parseGitProgressLine(stderrBuf);
        if (parsed) onProgress(parsed.phase, parsed.percent);
      }
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        reject(new Error(stderr.trim() || stdout.trim() || `git ${args[0]} exited with code ${code}`));
      }
    });
  });
}

function readRequirementsLines(resolvedRoot: string): string[] {
  try {
    const reqPath = path.join(resolvedRoot, 'requirements.txt');
    if (!fs.existsSync(reqPath)) return [];
    return fs
      .readFileSync(reqPath, 'utf-8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

function readLocalComfyVersion(resolvedRoot: string): string | null {
  try {
    const pyPath = path.join(resolvedRoot, 'comfyui_version.py');
    if (fs.existsSync(pyPath)) {
      const v = parseComfyVersionFromPython(fs.readFileSync(pyPath, 'utf-8'));
      if (v) return v;
    }
  } catch {
    // ignore
  }
  try {
    const tomlPath = path.join(resolvedRoot, 'pyproject.toml');
    if (fs.existsSync(tomlPath)) {
      const v = parseComfyVersionFromPyproject(fs.readFileSync(tomlPath, 'utf-8'));
      if (v) return v;
    }
  } catch {
    // ignore
  }
  return null;
}

async function detectDefaultBranch(cwd: string): Promise<string | null> {
  try {
    const sym = await runGit(cwd, ['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const name = sym.split('/').pop();
    if (name) return name;
  } catch {
    // ignore
  }
  for (const candidate of ['master', 'main']) {
    try {
      await runGit(cwd, ['show-ref', '--verify', `refs/heads/${candidate}`]);
      return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

async function fetchGitHubComfyReleases(): Promise<CoreReleaseItem[]> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/comfyanonymous/ComfyUI/releases?per_page=25',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ComfyNode-Sentinel',
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as Array<{
      tag_name?: string;
      name?: string;
      published_at?: string;
      html_url?: string;
      prerelease?: boolean;
      draft?: boolean;
    }>;
    if (!Array.isArray(json)) return [];
    return json
      .filter((r) => r.tag_name && !r.draft)
      .map((r) => ({
        tag: r.tag_name!,
        name: r.name?.trim() || r.tag_name!,
        publishedAt: r.published_at || null,
        url: r.html_url || `https://github.com/comfyanonymous/ComfyUI/releases/tag/${r.tag_name}`,
        isPrerelease: Boolean(r.prerelease),
      }));
  } catch {
    return [];
  }
}

async function readLocalTagReleases(cwd: string): Promise<CoreReleaseItem[]> {
  try {
    const tagsRaw = await runGit(cwd, ['tag', '--sort=-v:refname']);
    return tagsRaw
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 25)
      .map((tag) => ({
        tag,
        name: tag,
        publishedAt: null,
        url: `https://github.com/comfyanonymous/ComfyUI/releases/tag/${tag}`,
        isPrerelease: false,
      }));
  } catch {
    return [];
  }
}

async function readGitState(resolvedRoot: string) {
  const branch = await runGit(resolvedRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const commit = await runGit(resolvedRoot, ['rev-parse', '--short', 'HEAD']);
  const isDetached = branch === 'HEAD';
  const defaultBranch = await detectDefaultBranch(resolvedRoot);

  let tag: string | null = null;
  try {
    tag = await runGit(resolvedRoot, ['describe', '--tags', '--exact-match', 'HEAD']);
  } catch {
    try {
      tag = await runGit(resolvedRoot, ['describe', '--tags', '--abbrev=0', 'HEAD']);
    } catch {
      tag = null;
    }
  }

  let isDirty = false;
  try {
    const statusOut = await runGit(resolvedRoot, ['status', '--porcelain']);
    isDirty = statusOut.length > 0;
  } catch {
    isDirty = false;
  }

  return {
    branch,
    commit,
    tag,
    isDetached,
    defaultBranch,
    isDirty,
    version: readLocalComfyVersion(resolvedRoot) || tag,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: 'status' | 'update' | 'checkout' =
      body.action === 'update'
        ? 'update'
        : body.action === 'checkout'
          ? 'checkout'
          : 'status';
    const wantStream = Boolean(body.stream);
    const rawRoot = typeof body.comfyRoot === 'string' ? body.comfyRoot : '';
    const resolvedRoot = expandHomeDir(rawRoot);

    if (!resolvedRoot || !fs.existsSync(path.join(resolvedRoot, 'main.py'))) {
      return NextResponse.json(
        { error: 'Valid ComfyUI root directory is required' },
        { status: 400 }
      );
    }

    const hasRequirementsTxt = fs.existsSync(path.join(resolvedRoot, 'requirements.txt'));
    const isGitRepo = fs.existsSync(path.join(resolvedRoot, '.git'));

    if (!isGitRepo) {
      const localVersion = readLocalComfyVersion(resolvedRoot);
      const releases = action === 'status' ? await fetchGitHubComfyReleases() : [];
      return NextResponse.json({
        isGitRepo: false,
        version: localVersion,
        tag: localVersion ? `v${localVersion.replace(/^v/i, '')}` : null,
        branch: null,
        defaultBranch: null,
        isDetached: false,
        isDirty: false,
        commit: null,
        behindCount: 0,
        hasUpdate: false,
        incomingCommits: [],
        releases,
        latestReleaseTag: releases[0]?.tag ?? null,
        hasRequirementsTxt,
        message: 'No .git repository found in ComfyUI root (portable snapshot install).',
      });
    }

    if (action === 'update' || action === 'checkout') {
      const targetRef = typeof body.ref === 'string' ? body.ref.trim() : '';
      if (action === 'checkout' && !isValidGitRef(targetRef)) {
        return NextResponse.json(
          { error: 'Invalid git tag, branch, or commit reference.' },
          { status: 400 }
        );
      }

      const preState = await readGitState(resolvedRoot);
      if (preState.isDirty) {
        return NextResponse.json(
          {
            error:
              'ComfyUI working tree has uncommitted local changes. Commit, stash, or discard them before updating or switching versions.',
          },
          { status: 409 }
        );
      }

      const executeGitOp = async (onProgress: (phase: string, percent: number) => void) => {
        let requirementsChanged = false;
        let pullOutput = '';

        if (action === 'update') {
          if (preState.isDetached) {
            const branchTarget = preState.defaultBranch || 'master';
            await runGitStreaming(resolvedRoot, ['checkout', branchTarget, '--progress'], onProgress);
          }
          const res = await runGitStreaming(
            resolvedRoot,
            ['pull', '--ff-only', '--progress'],
            onProgress
          );
          pullOutput = res.stdout;
        } else {
          await runGitStreaming(
            resolvedRoot,
            ['fetch', '--tags', '--quiet'],
            onProgress
          ).catch(() => {});
          const res = await runGitStreaming(
            resolvedRoot,
            ['checkout', targetRef, '--progress'],
            onProgress
          );
          pullOutput = res.stdout || `Checked out ${targetRef}`;
        }

        const postState = await readGitState(resolvedRoot);
        if (preState.commit !== postState.commit) {
          try {
            const diffOut = await runGit(resolvedRoot, [
              'diff',
              '--name-only',
              preState.commit,
              postState.commit,
              '--',
              'requirements.txt',
            ]);
            requirementsChanged = diffOut.trim().length > 0;
          } catch {
            requirementsChanged = false;
          }
        }

        return {
          isGitRepo: true,
          previousCommit: preState.commit,
          previousBranch: preState.branch,
          commit: postState.commit,
          branch: postState.branch,
          defaultBranch: postState.defaultBranch,
          tag: postState.tag,
          version: postState.version,
          isDetached: postState.isDetached,
          isDirty: postState.isDirty,
          behindCount: 0,
          hasUpdate: false,
          updated: preState.commit !== postState.commit,
          requirementsChanged,
          hasRequirementsTxt,
          coreRequirements: hasRequirementsTxt ? readRequirementsLines(resolvedRoot) : [],
          message: pullOutput || 'ComfyUI Core is up to date.',
        };
      };

      if (wantStream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (payload: Record<string, unknown>) => {
              controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
            };
            try {
              send({ type: 'progress', phase: 'Preparing git', percent: 0 });
              const result = await executeGitOp((phase, percent) => {
                send({ type: 'progress', phase, percent });
              });
              send({ type: 'done', ...result });
            } catch (err) {
              send({
                type: 'error',
                error: err instanceof Error ? err.message : 'ComfyUI Core git operation failed',
              });
            } finally {
              controller.close();
            }
          },
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
          },
        });
      }

      const result = await executeGitOp(() => {});
      return NextResponse.json(result);
    }

    // action === 'status'
    const state = await readGitState(resolvedRoot);
    let behindCount = 0;
    let incomingCommits: CoreCommitItem[] = [];

    try {
      await runGit(resolvedRoot, ['fetch', '--tags', '--quiet']);
      const compareTarget = state.isDetached
        ? `origin/${state.defaultBranch || 'master'}`
        : '@{u}';
      const countStr = await runGit(resolvedRoot, ['rev-list', '--count', `HEAD..${compareTarget}`]);
      behindCount = Number.parseInt(countStr, 10) || 0;
      if (behindCount > 0) {
        const logOut = await runGit(resolvedRoot, [
          'log',
          '-n',
          '20',
          '--oneline',
          `HEAD..${compareTarget}`,
        ]);
        incomingCommits = parseGitOnelineLog(logOut);
      }
    } catch {
      behindCount = 0;
      incomingCommits = [];
    }

    const ghReleases = await fetchGitHubComfyReleases();
    const releases = ghReleases.length > 0 ? ghReleases : await readLocalTagReleases(resolvedRoot);

    return NextResponse.json({
      isGitRepo: true,
      version: state.version,
      tag: state.tag,
      branch: state.branch,
      defaultBranch: state.defaultBranch,
      isDetached: state.isDetached,
      isDirty: state.isDirty,
      commit: state.commit,
      behindCount,
      hasUpdate: behindCount > 0,
      incomingCommits,
      releases,
      latestReleaseTag: releases[0]?.tag ?? null,
      hasRequirementsTxt,
      coreRequirements: hasRequirementsTxt ? readRequirementsLines(resolvedRoot) : [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to inspect ComfyUI Core' },
      { status: 500 }
    );
  }
}
