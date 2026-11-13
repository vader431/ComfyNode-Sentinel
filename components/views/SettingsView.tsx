'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { EnvironmentSettings } from '@/types';
import { checkEnvironmentReal } from '@/lib/system-client';
import { isTauriEnvironment, nativePickDirectory, nativePickFile } from '@/lib/tauri-bridge';

interface SettingsViewProps {
  settings: EnvironmentSettings;
  onUpdateSettings: (settings: EnvironmentSettings) => void;
  onResetAllData: () => void;
}

export function SettingsView({
  settings,
  onUpdateSettings,
  onResetAllData,
}: SettingsViewProps) {
  const [comfyRootInput, setComfyRootInput] = useState(settings.comfyRoot);
  const [pythonBinaryInput, setPythonBinaryInput] = useState(settings.pythonBinary);
  const [pythonTypeInput, setPythonTypeInput] = useState(settings.pythonType);
  const [autoShield, setAutoShield] = useState(settings.autoTorchShield);
  const [cleanNames, setCleanNames] = useState(settings.showCleanNames);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pythonVersion, setPythonVersion] = useState<string>('');

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
      };

      onUpdateSettings(updated);
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Environment & Paths</span>
              <span aria-hidden="true">·</span>
              <span>Setup Wizard (Phase 0)</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              ComfyUI Environment Configuration
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Configure path discovery for <code>main.py</code>, <code>custom_nodes/</code>, and your designated Python runtime binary (Windows Portable embeded, venv, or system PATH).
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
                Root Filesystem Path (Rust command: <code>validate_comfy_root</code>)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={comfyRootInput}
                  onChange={(e) => setComfyRootInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                {isTauriEnvironment() && (
                  <button
                    type="button"
                    onClick={async () => {
                      const picked = await nativePickDirectory('Select ComfyUI Root Directory');
                      if (picked) setComfyRootInput(picked);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shrink-0"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Browse…</span>
                  </button>
                )}
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
                Python Binary Discovery (Rust: <code>detect_python_binary</code>)
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
                {isTauriEnvironment() && (
                  <button
                    type="button"
                    onClick={async () => {
                      const picked = await nativePickFile('Select Python Executable');
                      if (picked) setPythonBinaryInput(picked);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shrink-0"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Browse…</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">
                Safety & Display Preferences
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

        {/* Diagnostic Card (1 col) */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">
                Environment Diagnostic
              </h3>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <div className="text-slate-500 text-[10px]">App Platform:</div>
                <div className="text-slate-300 font-semibold">Tauri v2 + Rust tokio</div>
              </div>

              <div>
                <div className="text-slate-500 text-[10px]">Active OS Target:</div>
                <div className="text-slate-300">Windows 10/11 x86_64</div>
              </div>

              <div>
                <div className="text-slate-500 text-[10px]">Lockfile Engine:</div>
                <div className="text-slate-300">comfy-lock.json v1.0.0</div>
              </div>

              <div>
                <div className="text-slate-500 text-[10px]">Storage Backend:</div>
                <div className="text-slate-300">tauri-plugin-store (Local)</div>
              </div>
            </div>
          </div>

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
    </div>
  );
}
