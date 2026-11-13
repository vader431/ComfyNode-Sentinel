import { InstalledNode, ModelAsset } from '@/types';
import {
  isTauriEnvironment,
  nativeCheckEnvironment,
  nativeToggleNodeState,
  nativeQuarantineNodeToTrash,
} from './tauri-bridge';

export interface EnvironmentCheckResponse {
  isValidRoot: boolean;
  hasMainPy: boolean;
  hasCustomNodes: boolean;
  detectedPython: string;
  pythonVersion: string;
  pythonType?: 'windows_portable' | 'virtualenv' | 'system' | 'custom';
  error?: string;
}

export async function checkEnvironmentReal(
  comfyRoot: string,
  pythonBinary?: string
): Promise<EnvironmentCheckResponse> {
  if (isTauriEnvironment()) {
    const native = await nativeCheckEnvironment(comfyRoot);
    if (native) {
      return {
        isValidRoot: native.is_valid,
        hasMainPy: native.has_main_py,
        hasCustomNodes: native.has_custom_nodes,
        detectedPython: pythonBinary || 'python',
        pythonVersion: '',
        error: native.error_message,
      };
    }
  }

  const res = await fetch('/api/environment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comfyRoot, pythonBinary }),
  });
  return res.json();
}

export async function scanNodesReal(comfyRoot: string): Promise<{
  nodes: InstalledNode[];
  trashNodes: InstalledNode[];
  requirementsMap: Record<string, string[]>;
  error?: string;
}> {
  const res = await fetch('/api/nodes/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comfyRoot }),
  });
  return res.json();
}

export async function toggleNodeStateReal(
  comfyRoot: string,
  folderName: string
): Promise<{ success: boolean; newFolderName?: string; enabled?: boolean; error?: string }> {
  if (isTauriEnvironment()) {
    const sep = comfyRoot.includes('/') ? '/' : '\\';
    const customNodesPath = `${comfyRoot.replace(/[\\/]+$/, '')}${sep}custom_nodes`;
    const newFolderName = await nativeToggleNodeState(customNodesPath, folderName);
    if (newFolderName) {
      return {
        success: true,
        newFolderName,
        enabled: !newFolderName.endsWith('.disabled'),
      };
    }
  }

  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'toggle', comfyRoot, folderName }),
  });
  return res.json();
}

export async function uninstallNodeReal(
  comfyRoot: string,
  folderName: string
): Promise<{ success: boolean; error?: string }> {
  if (isTauriEnvironment()) {
    const sep = comfyRoot.includes('/') ? '/' : '\\';
    const customNodesPath = `${comfyRoot.replace(/[\\/]+$/, '')}${sep}custom_nodes`;
    const ok = await nativeQuarantineNodeToTrash(customNodesPath, folderName);
    if (ok) return { success: true };
  }

  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'uninstall', comfyRoot, folderName }),
  });
  return res.json();
}

export async function restoreNodeReal(
  comfyRoot: string,
  folderName: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'restore', comfyRoot, folderName }),
  });
  return res.json();
}

export async function normalizeNodeReal(
  comfyRoot: string,
  folderName: string,
  proposedName: string
): Promise<{ success: boolean; newFolderName?: string; error?: string }> {
  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'normalize', comfyRoot, folderName, proposedName }),
  });
  return res.json();
}

export async function cloneNodeReal(
  comfyRoot: string,
  gitUrl: string,
  branch?: string,
  folderName?: string
): Promise<{
  success?: boolean;
  folderName?: string;
  currentCommit?: string;
  branch?: string;
  requirements?: string[];
  output?: string;
  error?: string;
}> {
  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'clone', comfyRoot, gitUrl, branch, folderName }),
  });
  return res.json();
}

export async function checkUpdatesReal(comfyRoot: string): Promise<{
  updates?: { folderName: string; hasUpdate: boolean; behindCount: number; latestCommit?: string }[];
  error?: string;
}> {
  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check_updates', comfyRoot }),
  });
  return res.json();
}

export async function updateNodeReal(
  comfyRoot: string,
  folderName: string
): Promise<{
  success?: boolean;
  previousCommit?: string;
  newCommit?: string;
  output?: string;
  error?: string;
}> {
  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', comfyRoot, folderName }),
  });
  return res.json();
}

export async function rollbackNodeReal(
  comfyRoot: string,
  folderName: string,
  commitHash: string
): Promise<{ success?: boolean; output?: string; error?: string }> {
  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'rollback', comfyRoot, folderName, commitHash }),
  });
  return res.json();
}

export async function readNodeFileReal(
  comfyRoot: string,
  folderName: string,
  relativeFile: string
): Promise<{ success?: boolean; content?: string; error?: string }> {
  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'read_file', comfyRoot, folderName, relativeFile }),
  });
  return res.json();
}

export async function patchNodeFileReal(
  comfyRoot: string,
  folderName: string,
  relativeFile: string,
  content: string
): Promise<{ success?: boolean; error?: string }> {
  const res = await fetch('/api/nodes/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'patch_file', comfyRoot, folderName, relativeFile, content }),
  });
  return res.json();
}

export async function scanModelsReal(comfyRoot: string): Promise<{
  models: ModelAsset[];
  error?: string;
}> {
  const res = await fetch('/api/models/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comfyRoot }),
  });
  return res.json();
}

export async function deduplicateModelsReal(
  comfyRoot: string,
  primaryRelativePath: string,
  duplicateRelativePaths: string[]
): Promise<{ success: boolean; linked: string[]; errors: string[]; error?: string }> {
  const res = await fetch('/api/models/deduplicate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comfyRoot, primaryRelativePath, duplicateRelativePaths }),
  });
  return res.json();
}

export async function streamExecReal(
  params: {
    command?: string;
    comfyRoot: string;
    pythonBinary?: string;
    pipPackages?: string[];
  },
  onLine: (entry: { type: 'stdout' | 'stderr' | 'info' | 'success'; text: string }) => void,
  signal?: AbortSignal
): Promise<boolean> {
  const res = await fetch('/api/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.body) return false;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hadError = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'stderr' && parsed.text?.includes('exited with code')) {
          hadError = true;
        }
        onLine(parsed);
      } catch {
        onLine({ type: 'stdout', text: line });
      }
    }
  }

  return !hadError;
}

