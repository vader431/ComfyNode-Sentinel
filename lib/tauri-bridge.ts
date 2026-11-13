import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

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
 * Native OS directory picker (desktop only)
 */
export async function nativePickDirectory(title = 'Select ComfyUI Folder'): Promise<string | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title,
    });
    return typeof selected === 'string' ? selected : null;
  } catch (err) {
    console.error('Tauri directory dialog error:', err);
    return null;
  }
}

/**
 * Native OS file picker (desktop only)
 */
export async function nativePickFile(title = 'Select Python Executable'): Promise<string | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const selected = await openDialog({
      directory: false,
      multiple: false,
      title,
    });
    return typeof selected === 'string' ? selected : null;
  } catch (err) {
    console.error('Tauri file dialog error:', err);
    return null;
  }
}
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

