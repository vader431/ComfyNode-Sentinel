import {
  ComfyLockfile,
  InstalledNode,
  LockfileNodeEntry,
  ReconciliationItem,
} from '@/types';

/**
 * Generates a standard comfy-lock.json structure from currently installed nodes.
 */
export function generateComfyLockfile(
  nodes: InstalledNode[],
  comfyuiVersion: string = 'v0.3.18-cu124'
): ComfyLockfile {
  const nodeEntries: LockfileNodeEntry[] = nodes.map((node) => ({
    name: node.folderName,
    url: node.gitUrl,
    commit_hash: node.currentCommit,
    branch: node.branch || 'main',
    enabled_state: node.enabled,
  }));

  return {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    comfyui_version: comfyuiVersion,
    nodes: nodeEntries,
  };
}

/**
 * Formats installed nodes as a plain urls.txt file.
 */
export function exportAsPlainUrls(nodes: InstalledNode[]): string {
  const lines = [
    '# ComfyNode Sentinel - Exported Custom Nodes URL List',
    `# Generated: ${new Date().toLocaleDateString()}`,
    `# Total Repositories: ${nodes.length}`,
    '',
  ];

  for (const node of nodes) {
    const statusComment = node.enabled ? '' : ' # (disabled)';
    lines.push(`${node.gitUrl}${statusComment}`);
  }

  return lines.join('\n');
}

/**
 * Calculates 3-way reconciliation diff between local installation and target lockfile.
 */
export function calculateReconciliation(
  localNodes: InstalledNode[],
  lockfile: ComfyLockfile
): {
  items: ReconciliationItem[];
  actionsCount: {
    clone: number;
    checkout: number;
    toggle_state: number;
    keep_or_disable: number;
    in_sync: number;
  };
} {
  const localMapByUrl = new Map<string, InstalledNode>();
  const localMapByName = new Map<string, InstalledNode>();

  for (const node of localNodes) {
    if (node.gitUrl) localMapByUrl.set(normalizeGitUrl(node.gitUrl), node);
    localMapByName.set(node.folderName.toLowerCase(), node);
  }

  const items: ReconciliationItem[] = [];
  const processedLocalNodeIds = new Set<string>();

  // Compare lockfile items against local
  for (const entry of lockfile.nodes) {
    const normalizedUrl = normalizeGitUrl(entry.url);
    const localMatch = localMapByUrl.get(normalizedUrl) || localMapByName.get(entry.name.toLowerCase());

    if (!localMatch) {
      // Missing locally -> Need to clone
      items.push({
        name: entry.name,
        action: 'clone',
        reason: 'Missing locally. Clone repository and checkout pinned commit.',
        targetCommit: entry.commit_hash,
        targetEnabled: entry.enabled_state,
        gitUrl: entry.url,
      });
    } else {
      processedLocalNodeIds.add(localMatch.id);

      // Check commit hash mismatch
      const commitMismatch =
        entry.commit_hash &&
        localMatch.currentCommit &&
        !localMatch.currentCommit.startsWith(entry.commit_hash) &&
        !entry.commit_hash.startsWith(localMatch.currentCommit);

      // Check enabled state mismatch
      const stateMismatch = localMatch.enabled !== entry.enabled_state;

      if (commitMismatch) {
        items.push({
          name: localMatch.folderName,
          action: 'checkout',
          reason: `Commit mismatch: Local is at ${localMatch.currentCommit.slice(0, 7)}, lockfile pins ${entry.commit_hash.slice(0, 7)}.`,
          currentCommit: localMatch.currentCommit,
          targetCommit: entry.commit_hash,
          currentEnabled: localMatch.enabled,
          targetEnabled: entry.enabled_state,
          gitUrl: entry.url,
        });
      } else if (stateMismatch) {
        items.push({
          name: localMatch.folderName,
          action: 'toggle_state',
          reason: `State mismatch: Currently ${localMatch.enabled ? 'enabled' : 'disabled'}, lockfile specifies ${entry.enabled_state ? 'enabled' : 'disabled'}.`,
          currentCommit: localMatch.currentCommit,
          targetCommit: entry.commit_hash,
          currentEnabled: localMatch.enabled,
          targetEnabled: entry.enabled_state,
          gitUrl: entry.url,
        });
      } else {
        items.push({
          name: localMatch.folderName,
          action: 'in_sync',
          reason: 'Node is fully synchronized with pinned lockfile commit and state.',
          currentCommit: localMatch.currentCommit,
          targetCommit: entry.commit_hash,
          currentEnabled: localMatch.enabled,
          targetEnabled: entry.enabled_state,
          gitUrl: entry.url,
        });
      }
    }
  }

  // Check for local nodes that do not exist in the lockfile
  for (const localNode of localNodes) {
    if (!processedLocalNodeIds.has(localNode.id)) {
      items.push({
        name: localNode.folderName,
        action: 'keep_or_disable',
        reason: 'Node is installed locally but not listed in lockfile. Choose whether to keep, disable, or uninstall.',
        currentCommit: localNode.currentCommit,
        currentEnabled: localNode.enabled,
        gitUrl: localNode.gitUrl,
      });
    }
  }

  const actionsCount = {
    clone: items.filter((i) => i.action === 'clone').length,
    checkout: items.filter((i) => i.action === 'checkout').length,
    toggle_state: items.filter((i) => i.action === 'toggle_state').length,
    keep_or_disable: items.filter((i) => i.action === 'keep_or_disable').length,
    in_sync: items.filter((i) => i.action === 'in_sync').length,
  };

  return { items, actionsCount };
}

function normalizeGitUrl(url: string): string {
  if (!url) return '';
  return url
    .trim()
    .toLowerCase()
    .replace(/\.git$/, '')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/^http:\/\//, 'https://');
}
