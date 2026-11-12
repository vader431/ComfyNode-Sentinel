import { invoke } from '@tauri-apps/api/core';

/**
 * Returns true if running inside the Tauri v2 desktop webview shell.
 */
export function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

export interface NativeEnvironmentCheckResult {
  is_valid: boolean;
  has_main_py: boolean;
  has_custom_nodes: boolean;
  detected_root: string;
  error_message?: string;
}

export interface NativeDiscoveredNode {
  folder_name: string;
  clean_name: string;
  enabled: boolean;
  git_url: string;
  current_commit: string;
  branch: string;
}

/**
 * Native environment validation using Rust fs checks
 */
export async function nativeCheckEnvironment(
  comfyRoot: string
): Promise<NativeEnvironmentCheckResult | null> {
  if (!isTauriEnvironment()) return null;
  try {
    return await invoke<NativeEnvironmentCheckResult>('check_environment', {
      comfyRoot,
    });
  } catch (err) {
    console.error('Tauri check_environment error:', err);
    return null;
  }
}

/**
 * Native atomic folder toggle (Folder <-> Folder.disabled)
 */
export async function nativeToggleNodeState(
  customNodesPath: string,
  folderName: string
): Promise<string | null> {
  if (!isTauriEnvironment()) return null;
  try {
    return await invoke<string>('toggle_node_state', {
      customNodesPath,
      folderName,
    });
  } catch (err) {
    console.error('Tauri toggle_node_state error:', err);
    return null;
  }
}

/**
 * Native soft quarantine moving folder to system Recycle Bin / Trash
 */
export async function nativeQuarantineNodeToTrash(
  customNodesPath: string,
  folderName: string
): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    await invoke<void>('quarantine_node_to_trash', {
      customNodesPath,
      folderName,
    });
    return true;
  } catch (err) {
    console.error('Tauri quarantine_node_to_trash error:', err);
    return false;
  }
}

/**
 * Native filesystem scan of custom_nodes directory
 */
export async function nativeScanCustomNodes(
  customNodesPath: string
): Promise<NativeDiscoveredNode[] | null> {
  if (!isTauriEnvironment()) return null;
  try {
    return await invoke<NativeDiscoveredNode[]>('scan_custom_nodes', {
      customNodesPath,
    });
  } catch (err) {
    console.error('Tauri scan_custom_nodes error:', err);
    return null;
  }
}

