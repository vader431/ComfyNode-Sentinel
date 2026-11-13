import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { InstalledNode, HealthIssue, HealthStatus } from '@/types';
import { COMMUNITY_REGISTRY } from '@/lib/default-data';
import { lintPythonNodeCode } from '@/lib/health-linter';
import {
  collectPythonFiles,
  getFolderStats,
  readGitMetadata,
} from '@/lib/server-fs';

function scanDirectoryAsNodes(
  baseDir: string,
  isTrash: boolean
): {
  nodes: InstalledNode[];
  requirementsMap: Record<string, string[]>;
} {
  if (!fs.existsSync(baseDir)) {
    return { nodes: [], requirementsMap: {} };
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const nodes: InstalledNode[] = [];
  const requirementsMap: Record<string, string[]> = {};

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folderName = entry.name;
    if (folderName.startsWith('.') || folderName === '__pycache__') continue;

    const fullPath = path.join(baseDir, folderName);
    const enabled = isTrash ? false : !folderName.endsWith('.disabled');
    const cleanBase = folderName.replace(/\.disabled$/, '');
    const cleanDisplayName = cleanBase.replace(/^ComfyUI[-_]/i, '').replace(/[-_]+/g, ' ');

    const { gitUrl, branch, currentCommit } = readGitMetadata(fullPath);
    const { filesCount, sizeMb } = getFolderStats(fullPath);

    // Read requirements.txt if present
    const reqPath = path.join(fullPath, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      try {
        const reqRaw = fs.readFileSync(reqPath, 'utf-8');
        requirementsMap[folderName] = reqRaw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'));
      } catch {
        requirementsMap[folderName] = [];
      }
    }

    // Lint Python files for health issues
    const pyFiles = collectPythonFiles(fullPath, 10);
    const allIssues: HealthIssue[] = [];
    let worstStatus: HealthStatus = 'compliant';

    for (const pyFile of pyFiles) {
      try {
        const code = fs.readFileSync(pyFile, 'utf-8');
        const relFile = path.relative(fullPath, pyFile).replace(/\\/g, '/');
        const lint = lintPythonNodeCode(code, relFile);
        if (lint.issues.length > 0) {
          allIssues.push(...lint.issues);
          if (lint.status === 'os_locked') {
            worstStatus = 'os_locked';
          } else if (lint.status === 'fragile' && worstStatus === 'compliant') {
            worstStatus = 'fragile';
          }
        }
      } catch {
        // ignore unreadable files
      }
    }

    // Match against known registry for extra metadata
    const cleanUrl = gitUrl.replace(/\.git$/, '').toLowerCase();
    const regMatch = COMMUNITY_REGISTRY.find(
      (r) =>
        (cleanUrl && r.gitUrl.replace(/\.git$/, '').toLowerCase() === cleanUrl) ||
        r.name.toLowerCase() === cleanBase.toLowerCase()
    );

    let installedAt = new Date().toISOString().split('T')[0];
    try {
      installedAt = fs.statSync(fullPath).mtime.toISOString().split('T')[0];
    } catch {
      // ignore
    }

    const authorFromUrl = gitUrl.includes('github.com/')
      ? gitUrl.split('github.com/')[1]?.split('/')[0] || 'local'
      : 'local';

    const proposedNorm =
      !cleanBase.startsWith('ComfyUI-') && cleanBase.toLowerCase() !== 'comfyui-manager'
        ? `ComfyUI-${cleanBase.replace(/^comfyui[-_]?/i, '')}`
        : undefined;

    nodes.push({
      id: `node-${cleanBase}`,
      folderName,
      cleanDisplayName: regMatch?.name || cleanDisplayName || cleanBase,
      enabled,
      gitUrl: gitUrl || '',
      currentCommit: currentCommit || 'local',
      branch: branch || 'main',
      hasUpdate: false,
      filesCount,
      sizeMb,
      healthStatus: worstStatus,
      healthIssues: allIssues.slice(0, 25),
      installedAt,
      category: regMatch?.category || 'Custom',
      author: regMatch?.author || authorFromUrl,
      description:
        regMatch?.description ||
        (gitUrl ? `Git repository: ${gitUrl}` : `Local custom node directory (${folderName})`),
      providesNodes: regMatch?.nodeClasses || [],
      normalizedProposedName: proposedNorm,
    });
  }

  return { nodes, requirementsMap };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const comfyRoot = typeof body.comfyRoot === 'string' ? body.comfyRoot.trim() : '';

    if (!comfyRoot || !fs.existsSync(comfyRoot)) {
      return NextResponse.json(
        { error: 'ComfyUI root directory does not exist.', nodes: [], trashNodes: [], requirementsMap: {} },
        { status: 400 }
      );
    }

    const customNodesDir = path.join(comfyRoot, 'custom_nodes');
    if (!fs.existsSync(customNodesDir)) {
      return NextResponse.json(
        { error: 'custom_nodes/ directory not found inside ComfyUI root.', nodes: [], trashNodes: [], requirementsMap: {} },
        { status: 400 }
      );
    }

    const trashDir = path.join(comfyRoot, '.sentinel_trash');

    const activeScan = scanDirectoryAsNodes(customNodesDir, false);
    const trashScan = scanDirectoryAsNodes(trashDir, true);

    return NextResponse.json({
      nodes: activeScan.nodes,
      trashNodes: trashScan.nodes,
      requirementsMap: activeScan.requirementsMap,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

