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
    name: node.folderName.replace(/\.disabled$/i, ''),
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
    localMapByName.set(node.folderName.replace(/\.disabled$/i, '').toLowerCase(), node);
  }

  const items: ReconciliationItem[] = [];
  const processedLocalNodeIds = new Set<string>();

  // Compare lockfile items against local
  for (const entry of lockfile.nodes) {
    const normalizedUrl = normalizeGitUrl(entry.url);
    const entryBaseName = entry.name.replace(/\.disabled$/i, '').toLowerCase();
    const localMatch = localMapByUrl.get(normalizedUrl) || localMapByName.get(entryBaseName);

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

/**
 * Generates an idempotent bash provisioning script (bootstrap.sh) for headless Linux GPU cloud pods (RunPod, Vast.ai, Modal).
 * Clones ComfyUI, provisions custom nodes at pinned commits, and applies headless Torch Shield protection.
 */
export function generateCloudPodBootstrapScript(
  lockfile: ComfyLockfile,
  options: {
    targetDir?: string;
    port?: number;
    listenAll?: boolean;
    comfyGitUrl?: string;
  } = {}
): string {
  const targetDir = options.targetDir || '/workspace/ComfyUI';
  const port = options.port || 8188;
  const listenAll = options.listenAll !== false;
  const comfyGitUrl = options.comfyGitUrl || 'https://github.com/comfyanonymous/ComfyUI.git';

  const lines = [
    '#!/usr/bin/env bash',
    '# =====================================================================',
    '# ComfyNode Sentinel — Cloud Pod Provisioning Script (bootstrap.sh)',
    '# Target Platforms: RunPod, Vast.ai, Modal, Lambda Labs (Headless Linux)',
    `# Generated At: ${new Date().toISOString()}`,
    `# ComfyUI Target Version: ${lockfile.comfyui_version || 'v0.3.18'}`,
    `# Node Repositories Pinned: ${lockfile.nodes.length}`,
    '# =====================================================================',
    '',
    'set -euo pipefail',
    '',
    'echo "🚀 [Sentinel Cloud Pod] Initializing ComfyUI environment..."',
    '',
    '# Step 1: Verify NVIDIA GPU & CUDA environment',
    'if command -v nvidia-smi >/dev/null 2>&1; then',
    '    echo "✅ GPU Detected:"',
    '    nvidia-smi --query-gpu=gpu_name,driver_version,memory.total --format=csv,noheader',
    'else',
    '    echo "⚠️ Warning: No NVIDIA GPU detected. Running in CPU mode."',
    'fi',
    '',
    `TARGET_DIR="${targetDir}"`,
    'mkdir -p "$(dirname "$TARGET_DIR")"',
    '',
    '# Step 2: Clone or update ComfyUI base',
    'if [ ! -d "$TARGET_DIR" ]; then',
    `    echo "📦 Cloning ComfyUI base into $TARGET_DIR..."`,
    `    git clone "${comfyGitUrl}" "$TARGET_DIR"`,
    'fi',
    '',
    'cd "$TARGET_DIR"',
    'mkdir -p custom_nodes',
    '',
    'echo "🛡️ [Torch Shield] Capturing system PyTorch signature to prevent overwrite..."',
    'python3 -c "import torch; print(f\'System PyTorch: {torch.__version__} (CUDA: {torch.cuda.is_available()})\')" 2>/dev/null || true',
    '',
    'echo "📦 [Sentinel] Syncing locked custom nodes..."',
    '',
  ];

  for (const node of lockfile.nodes) {
    const nodeDir = `custom_nodes/${node.name}`;
    const disabledDir = `custom_nodes/${node.name}.disabled`;

    lines.push(`echo "--- Syncing ${node.name} ---"`);
    lines.push(`if [ ! -d "${nodeDir}" ] && [ ! -d "${disabledDir}" ]; then`);
    lines.push(`    git clone "${node.url}" "${nodeDir}"`);
    lines.push('fi');

    lines.push(`ACTUAL_DIR="${nodeDir}"`);
    lines.push(`[ -d "${disabledDir}" ] && ACTUAL_DIR="${disabledDir}"`);
    lines.push('');
    lines.push('pushd "$ACTUAL_DIR" > /dev/null');

    if (node.commit_hash) {
      lines.push('git fetch --all --quiet 2>/dev/null || true');
      lines.push(`git checkout -q "${node.commit_hash}"`);
    }

    // Torch Shield for requirements.txt
    lines.push('if [ -f "requirements.txt" ]; then');
    lines.push('    echo "  🔍 Inspecting requirements.txt with Torch Shield..."');
    lines.push('    # Strip dangerous torch/torchvision/torchaudio lines to protect cloud CUDA');
    lines.push(`    grep -v -E '^(torch|torchvision|torchaudio|xformers)(\\s*[<>=!~].*)?$' requirements.txt > .requirements.sanitized.txt || true`);
    lines.push('    if [ -s .requirements.sanitized.txt ]; then');
    lines.push('        pip install --no-cache-dir -r .requirements.sanitized.txt --quiet || true');
    lines.push('    fi');
    lines.push('    rm -f .requirements.sanitized.txt');
    lines.push('fi');

    lines.push('popd > /dev/null');

    // State handling
    if (!node.enabled_state) {
      lines.push(`if [ -d "${nodeDir}" ]; then`);
      lines.push(`    mv "${nodeDir}" "${disabledDir}"`);
      lines.push(`    echo "  ⏸️ Disabled ${node.name}"`);
      lines.push('fi');
    } else {
      lines.push(`if [ -d "${disabledDir}" ]; then`);
      lines.push(`    mv "${disabledDir}" "${nodeDir}"`);
      lines.push(`    echo "  ▶️ Enabled ${node.name}"`);
      lines.push('fi');
    }

    lines.push('');
  }

  const listenArg = listenAll ? '--listen 0.0.0.0' : '--listen 127.0.0.1';
  lines.push('echo "🎉 [Sentinel Cloud Pod] All custom nodes synchronized and shielded!"');
  lines.push('echo "🚀 Launching ComfyUI..."');
  lines.push(`python3 main.py ${listenArg} --port ${port}`);

  return lines.join('\n');
}
