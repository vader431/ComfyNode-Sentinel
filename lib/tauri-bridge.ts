import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { check as checkTauriUpdate } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import type { DesktopReleaseAsset, DesktopRuntimeInfo } from '@/types';

/**
 * Returns true if running inside the Tauri v2 desktop webview shell.
 */
export function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

/**
 * Enable or disable minimize-to-tray on window close (desktop only)
 */
export async function nativeSetMinimizeToTray(enabled: boolean): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    await invoke('set_minimize_to_tray', { enabled });
  } catch (err) {
    console.error('Tauri set_minimize_to_tray error:', err);
  }
}

/**
 * Synchronize live ComfyUI process & VRAM status with the system tray tooltip (desktop only)
 */
export async function nativeSyncTrayStatus(
  statusLabel: string,
  vramSummary?: string
): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    await invoke('sync_tray_status', {
      statusLabel,
      vramSummary: vramSummary || null,
    });
  } catch {
    // Ignore tray tooltip errors on platforms without system tray support
  }
}

/**
 * Query native desktop runtime diagnostics (OS, arch, bundled Node sidecar, standalone server)
 */
export async function nativeGetDesktopRuntimeInfo(): Promise<DesktopRuntimeInfo | null> {
  if (!isTauriEnvironment()) return null;
  try {
    return await invoke<DesktopRuntimeInfo>('get_desktop_runtime_info');
  } catch (err) {
    console.error('Tauri get_desktop_runtime_info error:', err);
    return null;
  }
}

export interface AppUpdateStatus {
  available: boolean;
  version?: string;
  currentVersion?: string;
  notes?: string;
  publishedAt?: string;
  releaseUrl?: string;
  isSignedNativeUpdate?: boolean;
  matchedAsset?: DesktopReleaseAsset | null;
  allAssets?: DesktopReleaseAsset[];
  error?: string;
  installAndRelaunch?: () => Promise<void>;
}

export function detectClientPlatformFamily(userAgentOverride?: string): 'windows' | 'macos' | 'linux' {
  const ua = (
    userAgentOverride ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  ).toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac') || ua.includes('darwin')) return 'macos';
  return 'linux';
}

export function classifyReleaseAssetPlatform(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.msi')) return 'Windows MSI Installer (x64)';
  if (lower.endsWith('.exe')) return 'Windows NSIS Setup (x64)';
  if (lower.endsWith('.dmg')) {
    return lower.includes('aarch64') || lower.includes('arm64')
      ? 'macOS Disk Image (Apple Silicon)'
      : 'macOS Disk Image (Intel/Universal)';
  }
  if (lower.endsWith('.app.tar.gz')) return 'macOS App Bundle Archive';
  if (lower.endsWith('.appimage')) return 'Linux AppImage (x86_64)';
  if (lower.endsWith('.deb')) return 'Debian / Ubuntu Package (.deb)';
  if (lower.endsWith('.rpm')) return 'Fedora / RHEL Package (.rpm)';
  return 'Release Archive';
}

export function matchPlatformReleaseAsset(
  assets: DesktopReleaseAsset[],
  platformFamily = detectClientPlatformFamily()
): DesktopReleaseAsset | null {
  if (!assets || assets.length === 0) return null;

  if (platformFamily === 'windows') {
    return (
      assets.find((a) => a.name.toLowerCase().endsWith('.msi')) ||
      assets.find((a) => a.name.toLowerCase().endsWith('.exe')) ||
      null
    );
  }

  if (platformFamily === 'macos') {
    return (
      assets.find((a) => a.name.toLowerCase().endsWith('.dmg')) ||
      assets.find((a) => a.name.toLowerCase().endsWith('.app.tar.gz')) ||
      null
    );
  }

  return (
    assets.find((a) => a.name.toLowerCase().endsWith('.appimage')) ||
    assets.find((a) => a.name.toLowerCase().endsWith('.deb')) ||
    assets.find((a) => a.name.toLowerCase().endsWith('.rpm')) ||
    null
  );
}

/**
 * Check for app updates via Tauri updater plugin (falling back to GitHub Releases API with OS asset matching)
 */
export async function nativeCheckAppUpdate(currentVersion: string): Promise<AppUpdateStatus> {
  if (isTauriEnvironment()) {
    try {
      const update = await checkTauriUpdate();
      if (update) {
        return {
          available: true,
          version: update.version,
          currentVersion,
          notes: update.body,
          isSignedNativeUpdate: true,
          installAndRelaunch: async () => {
            await update.downloadAndInstall();
            await relaunch();
          },
        };
      }
    } catch {
      // Fallback to GitHub Releases API check if signing key / latest.json is not yet published
    }
  }

  try {
    const res = await fetch(
      'https://api.github.com/repos/vader431/ComfyNode-Sentinel/releases/latest',
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) {
      return { available: false, version: currentVersion, currentVersion };
    }
    const data = (await res.json()) as {
      tag_name?: string;
      body?: string;
      html_url?: string;
      published_at?: string;
      assets?: Array<{
        name?: string;
        browser_download_url?: string;
        size?: number;
      }>;
    };

    const rawAssets = Array.isArray(data.assets) ? data.assets : [];
    const allAssets: DesktopReleaseAsset[] = rawAssets
      .filter((a) => Boolean(a.name && a.browser_download_url))
      .map((a) => ({
        name: String(a.name),
        downloadUrl: String(a.browser_download_url),
        sizeBytes: Number(a.size) || 0,
        platformLabel: classifyReleaseAssetPlatform(String(a.name)),
      }));

    const matchedAsset = matchPlatformReleaseAsset(allAssets);
    const latest = (data.tag_name || '').replace(/^v/i, '');
    const available = Boolean(latest && latest !== currentVersion);

    return {
      available,
      version: latest || currentVersion,
      currentVersion,
      notes: data.body,
      publishedAt: data.published_at,
      releaseUrl: data.html_url || 'https://github.com/vader431/ComfyNode-Sentinel/releases',
      isSignedNativeUpdate: false,
      matchedAsset,
      allAssets,
    };
  } catch (err) {
    return {
      available: false,
      currentVersion,
      error: err instanceof Error ? err.message : 'Update check failed',
    };
  }
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
