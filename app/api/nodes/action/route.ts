import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolveSafeSubpath, readGitMetadata } from '@/lib/server-fs';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, comfyRoot } = body;

    if (!comfyRoot || typeof comfyRoot !== 'string' || !fs.existsSync(comfyRoot)) {
      return NextResponse.json({ error: 'Invalid or missing comfyRoot path.' }, { status: 400 });
    }

    const customNodesDir = path.join(comfyRoot, 'custom_nodes');
    const trashDir = path.join(comfyRoot, '.sentinel_trash');

    switch (action) {
      case 'toggle': {
        const { folderName } = body;
        let actualFolderName = folderName;
        let sourcePath = resolveSafeSubpath(customNodesDir, actualFolderName);
        if (!fs.existsSync(sourcePath) && !actualFolderName.endsWith('.disabled')) {
          const disabledCandidate = `${actualFolderName}.disabled`;
          const disabledPath = resolveSafeSubpath(customNodesDir, disabledCandidate);
          if (fs.existsSync(disabledPath)) {
            actualFolderName = disabledCandidate;
            sourcePath = disabledPath;
          }
        }
        if (!fs.existsSync(sourcePath)) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        const isDisabled = actualFolderName.endsWith('.disabled');
        const newFolderName = isDisabled
          ? actualFolderName.replace(/\.disabled$/, '')
          : `${actualFolderName}.disabled`;
        const targetPath = resolveSafeSubpath(customNodesDir, newFolderName);

        fs.renameSync(sourcePath, targetPath);
        return NextResponse.json({ success: true, newFolderName, enabled: isDisabled });
      }

      case 'uninstall': {
        const { folderName } = body;
        let actualFolderName = folderName;
        let sourcePath = resolveSafeSubpath(customNodesDir, actualFolderName);
        if (!fs.existsSync(sourcePath) && !actualFolderName.endsWith('.disabled')) {
          const disabledCandidate = `${actualFolderName}.disabled`;
          const disabledPath = resolveSafeSubpath(customNodesDir, disabledCandidate);
          if (fs.existsSync(disabledPath)) {
            actualFolderName = disabledCandidate;
            sourcePath = disabledPath;
          }
        }
        if (!fs.existsSync(sourcePath)) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        fs.mkdirSync(trashDir, { recursive: true });
        const targetPath = resolveSafeSubpath(trashDir, actualFolderName.replace(/\.disabled$/, ''));
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
        fs.renameSync(sourcePath, targetPath);
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
        const sourcePath = resolveSafeSubpath(customNodesDir, folderName);
        if (!fs.existsSync(sourcePath)) {
          return NextResponse.json({ error: `Folder not found: ${folderName}` }, { status: 404 });
        }
        const isDisabled = folderName.endsWith('.disabled');
        const finalName = isDisabled ? `${proposedName}.disabled` : proposedName;
        const targetPath = resolveSafeSubpath(customNodesDir, finalName);
        fs.renameSync(sourcePath, targetPath);
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
          .filter((e) => e.isDirectory() && fs.existsSync(path.join(customNodesDir, e.name, '.git')));

        const updates: { folderName: string; hasUpdate: boolean; behindCount: number; latestCommit?: string }[] = [];
        const concurrency = 6;

        for (let i = 0; i < entries.length; i += concurrency) {
          const batch = entries.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map(async (entry) => {
              const nodePath = path.join(customNodesDir, entry.name);
              try {
                await execFileAsync('git', ['-C', nodePath, 'fetch', '--quiet'], { timeout: 15000 });
                const { stdout: countOut } = await execFileAsync(
                  'git',
                  ['-C', nodePath, 'rev-list', 'HEAD..@{u}', '--count'],
                  { timeout: 5000 }
                );
                const behindCount = parseInt(countOut.trim(), 10) || 0;
                let latestCommit: string | undefined;
                if (behindCount > 0) {
                  const { stdout: shaOut } = await execFileAsync(
                    'git',
                    ['-C', nodePath, 'rev-parse', '--short', '@{u}'],
                    { timeout: 5000 }
                  );
                  latestCommit = shaOut.trim();
                }
                return {
                  folderName: entry.name,
                  hasUpdate: behindCount > 0,
                  behindCount,
                  latestCommit,
                };
              } catch {
                // Skip repos without upstream tracking branch
                return null;
              }
            })
          );
          for (const r of batchResults) {
            if (r) updates.push(r);
          }
        }

        return NextResponse.json({ success: true, updates });
      }

      case 'update': {
        const { folderName } = body;
        const nodePath = resolveSafeSubpath(customNodesDir, folderName);
        if (!fs.existsSync(path.join(nodePath, '.git'))) {
          return NextResponse.json({ error: `${folderName} is not a git repository.` }, { status: 400 });
        }
        const prevMeta = readGitMetadata(nodePath);
        const { stdout, stderr } = await execFileAsync('git', ['-C', nodePath, 'pull'], {
          timeout: 60000,
        });
        const newMeta = readGitMetadata(nodePath);

        return NextResponse.json({
          success: true,
          folderName,
          previousCommit: prevMeta.currentCommit,
          newCommit: newMeta.currentCommit,
          output: (stdout + '\n' + stderr).trim(),
        });
      }

      case 'rollback': {
        const { folderName, commitHash } = body;
        const nodePath = resolveSafeSubpath(customNodesDir, folderName);
        if (!fs.existsSync(path.join(nodePath, '.git'))) {
          return NextResponse.json({ error: `${folderName} is not a git repository.` }, { status: 400 });
        }
        const { stdout, stderr } = await execFileAsync(
          'git',
          ['-C', nodePath, 'checkout', commitHash],
          { timeout: 30000 }
        );
        return NextResponse.json({
          success: true,
          folderName,
          currentCommit: commitHash,
          output: (stdout + '\n' + stderr).trim(),
        });
      }

      case 'read_file': {
        const { folderName, relativeFile } = body;
        const filePath = resolveSafeSubpath(customNodesDir, folderName, relativeFile);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return NextResponse.json({ success: true, content });
      }

      case 'patch_file': {
        const { folderName, relativeFile, content } = body;
        const filePath = resolveSafeSubpath(customNodesDir, folderName, relativeFile);
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

