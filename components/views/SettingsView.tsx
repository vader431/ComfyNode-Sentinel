'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderCheck,
  FolderOpen,
  Cpu,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Check,
  ShieldCheck,
  Terminal,
  Plus,
  Trash2,
  Download,
  Layers,
  ExternalLink,
  Package,
} from 'lucide-react';
import { ComfyInstance, DesktopRuntimeInfo, EnvironmentSettings } from '@/types';
import { checkEnvironmentReal } from '@/lib/system-client';
import {
  AppUpdateStatus,
  detectClientPlatformFamily,
  isTauriEnvironment,
  nativeCheckAppUpdate,
  nativeGetDesktopRuntimeInfo,
  nativePickDirectory,
  nativePickFile,
  nativeSetMinimizeToTray,
} from '@/lib/tauri-bridge';
import { AppUpdaterModal } from '@/components/AppUpdaterModal';
import pkg from '../../package.json';

interface SettingsViewProps {
  settings: EnvironmentSettings;
  instances?: ComfyInstance[];
  activeInstanceId?: string;
  onUpdateSettings: (settings: EnvironmentSettings) => void;
  onSaveInstances?: (instances: ComfyInstance[]) => void;
  onSwitchInstance?: (instanceId: string) => void;
  onResetAllData: () => void;
}

function formatAssetSizeMb(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsView({
  settings,
  instances = [],
  activeInstanceId,
  onUpdateSettings,
  onSaveInstances,
  onSwitchInstance,
  onResetAllData,
}: SettingsViewProps) {
  const [comfyRootInput, setComfyRootInput] = useState(settings.comfyRoot);
  const [pythonBinaryInput, setPythonBinaryInput] = useState(settings.pythonBinary);
  const [pythonTypeInput, setPythonTypeInput] = useState(settings.pythonType);
  const [comfyPortInput, setComfyPortInput] = useState<number>(settings.comfyPort || 8188);
  const [autoShield, setAutoShield] = useState(settings.autoTorchShield);
  const [cleanNames, setCleanNames] = useState(settings.showCleanNames);
  const [minimizeToTray, setMinimizeToTray] = useState(settings.minimizeToTray ?? true);
  const [isBrowsingRoot, setIsBrowsingRoot] = useState(false);
  const [isBrowsingPython, setIsBrowsingPython] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [desktopInfo, setDesktopInfo] = useState<DesktopRuntimeInfo | null>(null);
  const [isUpdaterModalOpen, setIsUpdaterModalOpen] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pythonVersion, setPythonVersion] = useState<string>('');

  const isTauri = isTauriEnvironment();
  const detectedPlatform = detectClientPlatformFamily();

  useEffect(() => {
    if (!isTauri) return;
    void nativeGetDesktopRuntimeInfo().then((info) => {
      if (info) setDesktopInfo(info);
    });
  }, [isTauri]);

  const handleValidateAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    setValidationError(null);

    try {
      const check = await checkEnvironmentReal(comfyRootInput.trim(), pythonBinaryInput.trim());
      if (check.pythonVersion) setPythonVersion(check.pythonVersion);
      if (check.error) setValidationError(check.error);

      const updated: EnvironmentSettings = {
        comfyRoot: comfyRootInput.trim(),
        pythonBinary: pythonBinaryInput.trim() || check.detectedPython,
        pythonType: pythonTypeInput,
        isValidRoot: check.isValidRoot,
        hasMainPy: check.hasMainPy,
        hasCustomNodes: check.hasCustomNodes,
        showCleanNames: cleanNames,
        autoTorchShield: autoShield,
        comfyPort: comfyPortInput || 8188,
        minimizeToTray,
      };

      onUpdateSettings(updated);
      await nativeSetMinimizeToTray(minimizeToTray);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsChecking(false);
    }
  };

  const handleAutoDetectPython = async (type: EnvironmentSettings['pythonType']) => {
    setPythonTypeInput(type);
    const root = comfyRootInput.trim() || 'C:\\AI\\ComfyUI_windows_portable\\ComfyUI';

    if (type === 'windows_portable') {
      const parent = root.replace(/[\\/]+ComfyUI[\\/]?$/i, '');
      setPythonBinaryInput(`${parent}\\python_embeded\\python.exe`);
    } else if (type === 'virtualenv') {
      setPythonBinaryInput(`${root}\\venv\\Scripts\\python.exe`);
    } else if (type === 'system') {
      setPythonBinaryInput('python');
    }

    const check = await checkEnvironmentReal(root);
    if (check.detectedPython) {
      setPythonBinaryInput(check.detectedPython);
      setPythonVersion(check.pythonVersion);
      if (check.pythonType) setPythonTypeInput(check.pythonType);
    }
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await nativeCheckAppUpdate(pkg.version);
      setUpdateStatus(res);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Environment &amp; Desktop Packaging</span>
              <span aria-hidden="true">·</span>
              <span>Runtime Configuration</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              ComfyUI Environment &amp; Desktop Updater
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Configure path discovery for <code>main.py</code>, <code>custom_nodes/</code>, your designated Python runtime binary, and inspect Tauri v2 desktop updates.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form (2 cols) */}
        <form onSubmit={handleValidateAndSave} className="lg:col-span-2 space-y-6">
          {/* ComfyUI Root Path */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <FolderCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">
                ComfyUI Root Directory Path
              </h3>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Root Filesystem Path (Rust command: <code>check_environment</code>)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={comfyRootInput}
                  onChange={(e) => setComfyRootInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={isBrowsingRoot}
                  onClick={async () => {
                    setIsBrowsingRoot(true);
                    try {
                      const picked = await nativePickDirectory('Select ComfyUI Root Directory');
                      if (picked) {
                        setComfyRootInput(picked);
                        setValidationError(null);
                      }
                    } finally {
                      setIsBrowsingRoot(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 transition-colors shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isBrowsingRoot ? 'Browsing…' : 'Browse…'}</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] font-mono">
                <span className={`flex items-center gap-1 ${settings.hasMainPy ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {settings.hasMainPy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>{settings.hasMainPy ? 'main.py exists' : 'main.py not found'}</span>
                </span>
                <span className={`flex items-center gap-1 ${settings.hasCustomNodes ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {settings.hasCustomNodes ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>{settings.hasCustomNodes ? 'custom_nodes/ exists' : 'custom_nodes/ not found'}</span>
                </span>
                {pythonVersion && (
                  <span className="text-sky-400">Python: {pythonVersion}</span>
                )}
              </div>
              {validationError && (
                <p className="text-xs text-rose-400 mt-1.5 font-mono">{validationError}</p>
              )}
            </div>
          </div>

          {/* Python Environment */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                Python Binary Discovery
              </h3>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Auto-Detection Target Preset:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleAutoDetectPython('windows_portable')}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                    pythonTypeInput === 'windows_portable'
                      ? 'border-indigo-500 bg-indigo-950/20 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-slate-200">Windows Portable</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    python_embeded\python.exe
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAutoDetectPython('virtualenv')}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                    pythonTypeInput === 'virtualenv'
                      ? 'border-indigo-500 bg-indigo-950/20 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-slate-200">Virtualenv (venv)</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    venv\Scripts\python.exe
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAutoDetectPython('system')}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                    pythonTypeInput === 'system'
                      ? 'border-indigo-500 bg-indigo-950/20 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-slate-200">System Python</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    PATH fallback
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Resolved Python Executable Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={pythonBinaryInput}
                  onChange={(e) => setPythonBinaryInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={isBrowsingPython}
                  onClick={async () => {
                    setIsBrowsingPython(true);
                    try {
                      const picked = await nativePickFile('Select Python Executable');
                      if (picked) setPythonBinaryInput(picked);
                    } finally {
                      setIsBrowsingPython(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 transition-colors shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isBrowsingPython ? 'Browsing…' : 'Browse…'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">
                Safety &amp; Display Preferences
              </h3>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    The &ldquo;Torch Shield&rdquo; Automatic Protection
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Automatically intercept requirements trying to install PyTorch over ComfyUI&apos;s CUDA runtime.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoShield}
                  onChange={(e) => setAutoShield(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Show Clean Display Names by Default
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Display user-friendly aliases instead of raw filesystem folder names in table views.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cleanNames}
                  onChange={(e) => setCleanNames(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    ComfyUI Server Port
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Port passed to <code className="font-mono">main.py --port</code> and used for live WebSocket/GPU telemetry.
                  </div>
                </div>
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  value={comfyPortInput}
                  onChange={(e) => setComfyPortInput(Number(e.target.value) || 8188)}
                  className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {isTauri && (
                <label className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      Minimize to System Tray on Close
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Keep ComfyNode Sentinel running in the OS tray when closing the main window.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={minimizeToTray}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setMinimizeToTray(checked);
                      onUpdateSettings({
                        ...settings,
                        minimizeToTray: checked,
                      });
                      void nativeSetMinimizeToTray(checked);
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {savedSuccess && (
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1 animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Configuration Saved</span>
              </span>
            )}
            <button
              type="submit"
              disabled={isChecking}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
            >
              {isChecking ? 'Validating on Disk...' : 'Save Environment Configuration'}
            </button>
          </div>
        </form>

        {/* Right Column: Desktop Packaging, Auto-Updater & Instances */}
        <div className="space-y-6">
          {/* Desktop Runtime & Packaging Diagnostic */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">
                Desktop &amp; Runtime Diagnostic
              </h3>
            </div>

            <div className="space-y-3 text-xs font-mono tabular-nums">
              <div>
                <div className="text-slate-500 text-[10px]">Runtime Shell:</div>
                <div className="text-slate-200 font-semibold">
                  {isTauri ? 'Tauri v2 Native Desktop' : 'Next.js Standalone Web Console'}
                </div>
              </div>

              <div>
                <div className="text-slate-500 text-[10px]">Detected Target Platform:</div>
                <div className="text-slate-300">
                  {desktopInfo
                    ? `${desktopInfo.os} (${desktopInfo.arch})`
                    : `${detectedPlatform.toUpperCase()} Client`}
                </div>
              </div>

              {desktopInfo && (
                <div>
                  <div className="text-slate-500 text-[10px]">Bundled Node Sidecar:</div>
                  <div className={desktopInfo.hasBundledNode ? 'text-emerald-400' : 'text-amber-300'}>
                    {desktopInfo.hasBundledNode
                      ? 'Verified (Embedded Node Runtime)'
                      : 'System Node Fallback'}
                  </div>
                </div>
              )}

              <div>
                <div className="text-slate-500 text-[10px]">Lockfile Schema:</div>
                <div className="text-slate-300">comfy-lock.json v1.0.0</div>
              </div>
            </div>
          </div>

          {/* Desktop Packaging & Auto-Updater Center */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-semibold text-white font-mono tabular-nums">
                  Release &amp; Updater (v{pkg.version})
                </h4>
              </div>
              <button
                type="button"
                disabled={isCheckingUpdate}
                onClick={handleCheckUpdates}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-3 h-3 text-indigo-400" />
                <span>{isCheckingUpdate ? 'Checking…' : 'Check Updates'}</span>
              </button>
            </div>

            {!updateStatus ? (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Checks Tauri signed update manifest and GitHub Releases for platform installers (<code>.msi</code>, <code>.exe</code>, <code>.dmg</code>, <code>.AppImage</code>).
                </p>
                <button
                  type="button"
                  onClick={() => setIsUpdaterModalOpen(true)}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Open Release &amp; Updater Modal</span>
                </button>
              </div>
            ) : updateStatus.error ? (
              <div className="text-[11px] font-mono text-rose-400 p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/50">
                {updateStatus.error}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {updateStatus.available ? (
                  <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/20 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-emerald-300 tabular-nums">
                        Update Available: v{updateStatus.version}
                      </span>
                      {updateStatus.isSignedNativeUpdate && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-mono">
                          Signed Tauri Update
                        </span>
                      )}
                    </div>

                    {updateStatus.installAndRelaunch ? (
                      <button
                        type="button"
                        disabled={isInstallingUpdate}
                        onClick={async () => {
                          setIsInstallingUpdate(true);
                          try {
                            await updateStatus.installAndRelaunch?.();
                          } finally {
                            setIsInstallingUpdate(false);
                          }
                        }}
                        className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                      >
                        {isInstallingUpdate
                          ? 'Downloading & Verifying Signature…'
                          : 'Download, Install & Relaunch'}
                      </button>
                    ) : updateStatus.matchedAsset ? (
                      <a
                        href={updateStatus.matchedAsset.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                      >
                        <span className="truncate">
                          Download {updateStatus.matchedAsset.platformLabel}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums opacity-90 shrink-0">
                          {formatAssetSizeMb(updateStatus.matchedAsset.sizeBytes)}
                        </span>
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span>Up to date (v{pkg.version})</span>
                    {updateStatus.releaseUrl && (
                      <a
                        href={updateStatus.releaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200"
                      >
                        <span>Releases</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {updateStatus.matchedAsset && !updateStatus.available && (
                  <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/80 space-y-1.5">
                    <div className="text-[10px] font-mono text-slate-400">
                      Matched Desktop Installer for Your OS:
                    </div>
                    <a
                      href={updateStatus.matchedAsset.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 text-[11px] font-mono text-indigo-300 hover:text-indigo-200"
                    >
                      <span className="truncate">{updateStatus.matchedAsset.name}</span>
                      <span className="text-slate-500 shrink-0 tabular-nums">
                        {formatAssetSizeMb(updateStatus.matchedAsset.sizeBytes)}
                      </span>
                    </a>
                  </div>
                )}

                {updateStatus.notes && (
                  <div className="p-2.5 rounded-lg border border-slate-800/80 bg-slate-950/70 max-h-32 overflow-y-auto text-[11px] font-mono text-slate-400 whitespace-pre-wrap">
                    {updateStatus.notes}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ComfyUI Instances Manager */}
          {onSaveInstances && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-semibold text-white">
                  ComfyUI Instances ({instances.length})
                </h4>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {instances.map((inst) => {
                  const isActive = inst.id === activeInstanceId;
                  return (
                    <div
                      key={inst.id}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                        isActive
                          ? 'border-indigo-500/60 bg-indigo-950/30'
                          : 'border-slate-800 bg-slate-950/70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSwitchInstance?.(inst.id)}
                        className="text-left min-w-0 flex-1"
                      >
                        <div className="font-semibold text-slate-200 truncate">
                          {inst.name}{' '}
                          <span className="text-[10px] font-mono tabular-nums text-indigo-300">
                            :{inst.port}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          {inst.comfyRoot}
                        </div>
                      </button>
                      {instances.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            onSaveInstances(instances.filter((item) => item.id !== inst.id))
                          }
                          title="Remove instance"
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Instance name (e.g. Flux Studio)"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newInstanceName.trim() || `Instance ${instances.length + 1}`;
                    const next: ComfyInstance = {
                      id: `inst-${Date.now()}`,
                      name,
                      comfyRoot: comfyRootInput.trim(),
                      pythonBinary: pythonBinaryInput.trim() || 'python',
                      pythonType: pythonTypeInput,
                      port: comfyPortInput || 8188,
                    };
                    onSaveInstances([...instances, next]);
                    setNewInstanceName('');
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save As</span>
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-semibold text-rose-300">
              Reset Application State
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Resets all installed nodes, aliases, custom tasks, and profiles back to factory demonstration defaults.
            </p>
            <button
              type="button"
              onClick={onResetAllData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>
          </div>
        </div>
      </div>
      <AppUpdaterModal isOpen={isUpdaterModalOpen} onClose={() => setIsUpdaterModalOpen(false)} />
    </div>
  );
}
