'use client';

import React, { useState } from 'react';
import { FolderOpen, CheckCircle2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { EnvironmentSettings } from '@/types';
import { checkEnvironmentReal } from '@/lib/system-client';

interface OnboardingCardProps {
  settings: EnvironmentSettings;
  onSaveAndScan: (newSettings: EnvironmentSettings) => Promise<void> | void;
  onOpenFullSettings: () => void;
}

const PRESET_PATHS = [
  'C:\\AI\\ComfyUI_windows_portable\\ComfyUI',
  'C:\\ComfyUI',
  'D:\\ComfyUI',
];

export function OnboardingCard({
  settings,
  onSaveAndScan,
  onOpenFullSettings,
}: OnboardingCardProps) {
  const [rootPath, setRootPath] = useState(settings.comfyRoot || '');
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootPath.trim()) return;
    setIsChecking(true);
    setErrorMsg(null);
    try {
      const env = await checkEnvironmentReal(rootPath.trim(), settings.pythonBinary);
      if (!env.isValidRoot) {
        setErrorMsg(
          env.error ||
            `Could not find main.py and custom_nodes/ inside "${rootPath.trim()}".`
        );
      }
      await onSaveAndScan({
        ...settings,
        comfyRoot: rootPath.trim(),
        pythonBinary: env.detectedPython || settings.pythonBinary,
        isValidRoot: env.isValidRoot,
        hasMainPy: env.hasMainPy,
        hasCustomNodes: env.hasCustomNodes,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to validate directory');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 shadow-xl">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shrink-0">
          <FolderOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Connect Your ComfyUI Installation
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
            Point ComfyNode Sentinel to your local ComfyUI folder (containing{' '}
            <code className="font-mono text-slate-300">main.py</code> and{' '}
            <code className="font-mono text-slate-300">custom_nodes/</code>) to scan extensions,
            check git updates, and manage dependencies safely.
          </p>
        </div>
      </div>

      <form onSubmit={handleConnect} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            ComfyUI Root Directory
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="C:\AI\ComfyUI_windows_portable\ComfyUI"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              type="submit"
              disabled={isChecking || !rootPath.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isChecking ? 'Validating...' : 'Validate & Scan'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Quick paths:
          </span>
          {PRESET_PATHS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setRootPath(preset)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/30 border border-rose-800/60 text-xs text-rose-200 font-mono">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>

      <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Need custom Python binary or Torch Shield options?</span>
        <button
          type="button"
          onClick={onOpenFullSettings}
          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
        >
          <span>Full Settings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

