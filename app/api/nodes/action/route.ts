import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  collectPythonFiles,
  expandHomeDir,
  readGitMetadata,
  resolveSafeSubpath,
} from '@/lib/server-fs';

const execFileAsync = promisify(execFile);

/**
 * Resolves a node directory inside custom_nodes/, automatically handling
 * enabled/disabled (.disabled suffix) variants.
 */
function resolveExistingNodeFolder(
  customNodesDir: string,
  folderName: string
): { actualFolderName: string; fullPath: string } | null {
  if (!folderName || typeof folderName !== 'string') return null;

  const primaryPath = resolveSafeSubpath(customNodesDir, folderName);
  if (fs.existsSync(primaryPath)) {
    return { actualFolderName: folderName, fullPath: primaryPath };
  }

  const alternateName = folderName.endsWith('.disabled')
    ? folderName.replace(/\.disabled$/, '')
    : `${folderName}.disabled`;
  const alternatePath = resolveSafeSubpath(customNodesDir, alternateName);
  if (fs.existsSync(alternatePath)) {
    return { actualFolderName: alternateName, fullPath: alternatePath };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const comfyRoot = typeof body.comfyRoot === 'string' ? expandHomeDir(body.comfyRoot) : '';

    if (!comfyRoot || !fs.existsSync(comfyRoot)) {
      return NextResponse.json({ error: 'Invalid or missing comfyRoot path.' }, { status: 400 });
    }

    const customNodesDir = path.join(comfyRoot, 'custom_nodes');
    const trashDir = path.join(comfyRoot, '.sentinel_trash');

    switch (action) {
      case 'toggle': {
        const { folderName } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        const isDisabled = resolved.actualFolderName.endsWith('.disabled');
        const newFolderName = isDisabled
          ? resolved.actualFolderName.replace(/\.disabled$/, '')
          : `${resolved.actualFolderName}.disabled`;
        const targetPath = resolveSafeSubpath(customNodesDir, newFolderName);

        fs.renameSync(resolved.fullPath, targetPath);
        return NextResponse.json({ success: true, newFolderName, enabled: isDisabled });
      }

      case 'uninstall': {
        const { folderName } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        fs.mkdirSync(trashDir, { recursive: true });
        const targetPath = resolveSafeSubpath(
          trashDir,
          resolved.actualFolderName.replace(/\.disabled$/, '')
        );
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
        fs.renameSync(resolved.fullPath, targetPath);
        return NextResponse.json({ success: true, movedTo: targetPath });
      }

      case 'restore': {
        const { folderName } = body;
        const sourcePath = resolveSafeSubpath(trashDir, folderName);
        if (!fs.existsSync(sourcePath)) {
          return NextResponse.json({ error: `Trash folder not found: ${folderName}` }, { status: 404 });
        }
        const targetPath = resolveSafeSubpath(customNodesDir, folderName);
        fs.renameSync(sourcePath, targetPath);
        return NextResponse.json({ success: true, restoredTo: targetPath });
      }

      case 'normalize': {
        const { folderName, proposedName } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        const isDisabled = resolved.actualFolderName.endsWith('.disabled');
        const cleanProposed = String(proposedName || '').replace(/\.disabled$/, '');
        const finalName = isDisabled ? `${cleanProposed}.disabled` : cleanProposed;
        const targetPath = resolveSafeSubpath(customNodesDir, finalName);
        fs.renameSync(resolved.fullPath, targetPath);
        return NextResponse.json({ success: true, newFolderName: finalName });
      }

      case 'clone': {
        const { gitUrl, branch, folderName } = body;
        if (!gitUrl || typeof gitUrl !== 'string') {
          return NextResponse.json({ error: 'Missing gitUrl' }, { status: 400 });
        }
        const derivedFolder =
          folderName?.trim() ||
          gitUrl.split('/').pop()?.replace(/\.git$/i, '') ||
          'ComfyUI-CustomNode';
        const targetPath = resolveSafeSubpath(customNodesDir, derivedFolder);

        if (fs.existsSync(targetPath)) {
          return NextResponse.json(
            { error: `Directory already exists: ${derivedFolder}` },
            { status: 409 }
          );
        }

        const args = ['clone', '--depth', '1'];
        if (branch && typeof branch === 'string' && branch.trim()) {
          args.push('-b', branch.trim());
        }
        args.push(gitUrl.trim(), targetPath);

        const { stdout, stderr } = await execFileAsync('git', args, { timeout: 120000 });
        const meta = readGitMetadata(targetPath);

        let requirements: string[] = [];
        const reqFile = path.join(targetPath, 'requirements.txt');
        if (fs.existsSync(reqFile)) {
          requirements = fs
            .readFileSync(reqFile, 'utf-8')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'));
        }

        return NextResponse.json({
          success: true,
          folderName: derivedFolder,
          currentCommit: meta.currentCommit,
          branch: meta.branch,
          requirements,
          output: (stdout + '\n' + stderr).trim(),
        });
      }

      case 'check_updates': {
        if (!fs.existsSync(customNodesDir)) {
          return NextResponse.json({ success: true, updates: [] });
        }
        const entries = fs
          .readdirSync(customNodesDir, { withFileTypes: true })
          .filter((e) => {
            if (e.name.startsWith('.') || e.name === '__pycache__') return false;
            const nodePath = path.join(customNodesDir, e.name);
            let isDir = e.isDirectory();
            if (!isDir && e.isSymbolicLink()) {
              try {
                isDir = fs.statSync(nodePath).isDirectory();
              } catch {
                isDir = false;
              }
            }
            return isDir && fs.existsSync(path.join(nodePath, '.git'));
          });

        const total = entries.length;
        const wantStream = Boolean(body.stream);

        const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
        const runGitNode = (nodePath: string, args: string[], timeout = 10000) =>
          execFileAsync('git', ['-c', 'safe.directory=*', '-C', nodePath, ...args], {
            timeout,
            windowsHide: true,
            env: gitEnv,
          });

        const resolveUpstreamRef = async (nodePath: string): Promise<string | null> => {
          try {
            const { stdout } = await runGitNode(
              nodePath,
              ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
              5000
            );
            const ref = stdout.trim();
            if (ref) return ref;
          } catch {
            // No upstream tracking branch configured; try origin fallbacks
          }

          const candidates: string[] = [];
          try {
            const { stdout } = await runGitNode(nodePath, ['rev-parse', '--abbrev-ref', 'HEAD'], 5000);
            const branch = stdout.trim();
            if (branch && branch !== 'HEAD') {
              candidates.push(`origin/${branch}`);
            }
          } catch {
            // ignore
          }
          candidates.push('origin/HEAD', 'origin/main', 'origin/master');

          for (const candidate of candidates) {
            try {
              await runGitNode(nodePath, ['rev-parse', '--verify', candidate], 5000);
              return candidate;
            } catch {
              // try next candidate
            }
          }
          return null;
        };

        const checkRemoteViaLsRemote = async (
          nodePath: string
        ): Promise<{ hasUpdate: boolean; latestCommit?: string } | null> => {
          try {
            const { stdout: headOut } = await runGitNode(nodePath, ['rev-parse', 'HEAD'], 5000);
            const localHead = headOut.trim();
            if (!localHead) return null;

            let branch = '';
            try {
              const { stdout: branchOut } = await runGitNode(
                nodePath,
                ['rev-parse', '--abbrev-ref', 'HEAD'],
                5000
              );
              branch = branchOut.trim();
            } catch {
              branch = '';
            }

            const targetRef = branch && branch !== 'HEAD' ? `refs/heads/${branch}` : 'HEAD';
            const { stdout: lsOut } = await runGitNode(
              nodePath,
              ['ls-remote', 'origin', targetRef],
              15000
            );
            const firstLine = lsOut.split(/\r?\n/).find((l) => l.trim());
            if (!firstLine) return null;
            const remoteSha = firstLine.split(/\s+/)[0]?.trim();
            if (!remoteSha || remoteSha === localHead) {
              return { hasUpdate: false };
            }

            // Do not flag as an update if remoteSha is already an ancestor of local HEAD
            try {
              await runGitNode(nodePath, ['merge-base', '--is-ancestor', remoteSha, 'HEAD'], 5000);
              return { hasUpdate: false };
            } catch {
              return {
                hasUpdate: true,
                latestCommit: remoteSha.slice(0, 7),
              };
            }
          } catch {
            return null;
          }
        };

        const checkOneEntry = async (entry: fs.Dirent) => {
          const nodePath = path.join(customNodesDir, entry.name);
          try {
            await runGitNode(nodePath, ['fetch', '--quiet'], 30000).catch(() => {});
            const upstreamRef = await resolveUpstreamRef(nodePath);
            if (upstreamRef) {
              const { stdout: countOut } = await runGitNode(
                nodePath,
                ['rev-list', `HEAD..${upstreamRef}`, '--count'],
                5000
              );
              const behindCount = parseInt(countOut.trim(), 10) || 0;
              if (behindCount > 0) {
                const { stdout: shaOut } = await runGitNode(
                  nodePath,
                  ['rev-parse', '--short', upstreamRef],
                  5000
                );
                return {
                  folderName: entry.name,
                  hasUpdate: true,
                  behindCount,
                  latestCommit: shaOut.trim(),
                };
              }
            }

            // Cross-check with `git ls-remote origin` for shallow/detached/untracked repos
            const lsCheck = await checkRemoteViaLsRemote(nodePath);
            if (lsCheck?.hasUpdate) {
              return {
                folderName: entry.name,
                hasUpdate: true,
                behindCount: 1,
                latestCommit: lsCheck.latestCommit,
              };
            }

            return {
              folderName: entry.name,
              hasUpdate: false,
              behindCount: 0,
            };
          } catch {
            return {
              folderName: entry.name,
              hasUpdate: false,
              behindCount: 0,
            };
          }
        };

        const runCheckLoop = async (
          onProgress?: (current: number, totalCount: number, folderName: string) => void
        ) => {
          const updates: {
            folderName: string;
            hasUpdate: boolean;
            behindCount: number;
            latestCommit?: string;
          }[] = [];
          const concurrency = 6;
          let completed = 0;

          for (let i = 0; i < entries.length; i += concurrency) {
            const batch = entries.slice(i, i + concurrency);
            const batchResults = await Promise.all(
              batch.map(async (entry) => {
                const res = await checkOneEntry(entry);
                completed += 1;
                onProgress?.(completed, total, entry.name);
                return res;
              })
            );
            for (const r of batchResults) {
              if (r) updates.push(r);
            }
          }
          return updates;
        };

        if (wantStream) {
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const send = (payload: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
              };
              try {
                send({ type: 'progress', current: 0, total, folderName: '' });
                const updates = await runCheckLoop((current, totalCount, folderName) => {
                  send({ type: 'progress', current, total: totalCount, folderName });
                });
                send({ type: 'done', success: true, updates });
              } catch (err) {
                send({
                  type: 'error',
                  error: err instanceof Error ? err.message : 'Failed to check updates',
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

        const updates = await runCheckLoop();
        return NextResponse.json({ success: true, updates });
      }

      case 'update': {
        const { folderName } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        if (!fs.existsSync(path.join(resolved.fullPath, '.git'))) {
          return NextResponse.json({ error: `${folderName} is not a git repository.` }, { status: 400 });
        }
        const prevMeta = readGitMetadata(resolved.fullPath);
        const pullOpts = {
          timeout: 60000,
          windowsHide: true,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        };
        let stdout = '';
        let stderr = '';
        try {
          ({ stdout, stderr } = await execFileAsync(
            'git',
            ['-c', 'safe.directory=*', '-C', resolved.fullPath, 'pull'],
            pullOpts
          ));
        } catch (pullErr) {
          const fallbackBranch =
            prevMeta.branch && prevMeta.branch !== 'detached' ? prevMeta.branch : 'main';
          try {
            ({ stdout, stderr } = await execFileAsync(
              'git',
              ['-c', 'safe.directory=*', '-C', resolved.fullPath, 'pull', 'origin', fallbackBranch],
              pullOpts
            ));
          } catch {
            throw pullErr;
          }
        }
        const newMeta = readGitMetadata(resolved.fullPath);

        return NextResponse.json({
          success: true,
          folderName: resolved.actualFolderName,
          previousCommit: prevMeta.currentCommit,
          newCommit: newMeta.currentCommit,
          output: (stdout + '\n' + stderr).trim(),
        });
      }

      case 'rollback': {
        const { folderName, commitHash } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        if (!fs.existsSync(path.join(resolved.fullPath, '.git'))) {
          return NextResponse.json({ error: `${folderName} is not a git repository.` }, { status: 400 });
        }
        const { stdout, stderr } = await execFileAsync(
          'git',
          ['-C', resolved.fullPath, 'checkout', commitHash],
          { timeout: 30000 }
        );
        return NextResponse.json({
          success: true,
          folderName: resolved.actualFolderName,
          currentCommit: commitHash,
          output: (stdout + '\n' + stderr).trim(),
        });
      }

      case 'list_files': {
        const { folderName } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}`, files: [] }, { status: 404 });
        }
        const pyFiles = collectPythonFiles(resolved.fullPath, 40).map((absPath) =>
          path.relative(resolved.fullPath, absPath).replace(/\\/g, '/')
        );
        return NextResponse.json({ success: true, files: pyFiles });
      }

      case 'read_file': {
        const { folderName, relativeFile } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        const filePath = resolveSafeSubpath(resolved.fullPath, relativeFile);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return NextResponse.json({ success: true, content });
      }

      case 'read_readme': {
        const { folderName } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        const candidates = ['README.md', 'readme.md', 'Readme.md', 'README.MD', 'README.rst', 'README.txt', 'README'];
        for (const candidate of candidates) {
          const filePath = resolveSafeSubpath(resolved.fullPath, candidate);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return NextResponse.json({ success: true, fileName: candidate, content });
          }
        }
        return NextResponse.json({ error: 'No README file found in node directory.' }, { status: 404 });
      }

      case 'reinstall': {
        const { folderName, gitUrl } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        const targetFolder = resolved.actualFolderName;
        const nodePath = resolved.fullPath;

        let output = '';
        if (fs.existsSync(path.join(nodePath, '.git'))) {
          const fetchRes = await execFileAsync('git', ['-C', nodePath, 'fetch', '--all'], {
            timeout: 60000,
          });
          const resetRes = await execFileAsync('git', ['-C', nodePath, 'reset', '--hard', 'HEAD'], {
            timeout: 30000,
          });
          const pullRes = await execFileAsync('git', ['-C', nodePath, 'pull', '--ff-only'], {
            timeout: 60000,
          }).catch((e: unknown) => ({
            stdout: '',
            stderr: e instanceof Error ? e.message : 'pull skipped',
          }));
          output = [
            fetchRes.stdout,
            fetchRes.stderr,
            resetRes.stdout,
            resetRes.stderr,
            pullRes.stdout,
            pullRes.stderr,
          ]
            .filter(Boolean)
            .join('\n')
            .trim();
        } else if (gitUrl && typeof gitUrl === 'string') {
          fs.mkdirSync(trashDir, { recursive: true });
          const backupPath = resolveSafeSubpath(trashDir, `${targetFolder}.reinstall-bak`);
          if (fs.existsSync(backupPath)) {
            fs.rmSync(backupPath, { recursive: true, force: true });
          }
          fs.renameSync(nodePath, backupPath);
          try {
            const cloneRes = await execFileAsync(
              'git',
              ['clone', '--depth', '1', gitUrl.trim(), nodePath],
              { timeout: 120000 }
            );
            output = [cloneRes.stdout, cloneRes.stderr].filter(Boolean).join('\n').trim();
            fs.rmSync(backupPath, { recursive: true, force: true });
          } catch (cloneErr) {
            if (fs.existsSync(nodePath)) {
              fs.rmSync(nodePath, { recursive: true, force: true });
            }
            if (fs.existsSync(backupPath)) {
              fs.renameSync(backupPath, nodePath);
            }
            throw cloneErr;
          }
        } else {
          return NextResponse.json(
            { error: `${folderName} is not a git repository and no gitUrl was provided.` },
            { status: 400 }
          );
        }

        const meta = readGitMetadata(nodePath);
        let requirements: string[] = [];
        const reqFile = path.join(nodePath, 'requirements.txt');
        if (fs.existsSync(reqFile)) {
          requirements = fs
            .readFileSync(reqFile, 'utf-8')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'));
        }

        return NextResponse.json({
          success: true,
          folderName: targetFolder,
          currentCommit: meta.currentCommit,
          branch: meta.branch,
          requirements,
          output,
        });
      }

      case 'patch_file': {
        const { folderName, relativeFile, content } = body;
        const resolved = resolveExistingNodeFolder(customNodesDir, folderName);
        if (!resolved) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        const filePath = resolveSafeSubpath(resolved.fullPath, relativeFile);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Node action failed' },
      { status: 500 }
    );
  }
}
