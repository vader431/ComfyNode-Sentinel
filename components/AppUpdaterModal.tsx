'use client';

import React, { useState } from 'react';
import { X, Download, RefreshCw, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import {
  AppUpdateStatus,
  nativeCheckAppUpdate,
} from '@/lib/tauri-bridge';
import pkg from '../package.json';

interface AppUpdaterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppUpdaterModal({ isOpen, onClose }: AppUpdaterModalProps) {
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isOpen) return null;

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      const res = await nativeCheckAppUpdate(pkg.version);
      setUpdateStatus(res);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0c1017] p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Software Update &amp; Release Center
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Current Installed Version: <strong className="text-white">v{pkg.version}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action / Check Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div>
              <h3 className="text-xs font-semibold text-slate-200">
                Check Upstream Releases
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Query Tauri signed update channel and GitHub Releases for new assets.
              </p>
            </div>
            <button
              type="button"
              disabled={isChecking}
              onClick={handleCheck}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking…' : 'Check for Updates'}</span>
            </button>
          </div>

          {/* Status Result */}
          {updateStatus && (
            <div className="space-y-3">
              {updateStatus.error ? (
                <div className="p-3.5 rounded-xl border border-rose-800/60 bg-rose-950/30 flex items-start gap-2.5 text-xs text-rose-300 font-mono">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-sans font-semibold">Update check encountered an error:</strong>
                    <p className="mt-1">{updateStatus.error}</p>
                  </div>
                </div>
              ) : updateStatus.available ? (
                <div className="p-4 rounded-xl border border-emerald-500/50 bg-emerald-950/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5 font-mono">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>New Version Available: v{updateStatus.version}</span>
                    </span>
                    {updateStatus.isSignedNativeUpdate && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-mono">
                        Signed Native Update
                      </span>
                    )}
                  </div>

                  {updateStatus.notes && (
                    <div className="p-3 rounded-lg border border-emerald-900/50 bg-slate-950/80 max-h-36 overflow-y-auto text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {updateStatus.notes}
                    </div>
                  )}

                  {updateStatus.installAndRelaunch ? (
                    <button
                      type="button"
                      disabled={isInstalling}
                      onClick={async () => {
                        setIsInstalling(true);
                        try {
                          await updateStatus.installAndRelaunch?.();
                        } finally {
                          setIsInstalling(false);
                        }
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className={`w-4 h-4 ${isInstalling ? 'animate-bounce' : ''}`} />
                      <span>
                        {isInstalling ? 'Downloading & Applying Patch…' : 'Restart to Update'}
                      </span>
                    </button>
                  ) : updateStatus.matchedAsset ? (
                    <a
                      href={updateStatus.matchedAsset.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
                    >
                      <span>Download {updateStatus.matchedAsset.platformLabel}</span>
                      <span className="font-mono text-[10px] tabular-nums opacity-90">
                        {(updateStatus.matchedAsset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div className="text-xs">
                    <strong className="text-white">You are running the latest version</strong>
                    <p className="text-slate-400 mt-0.5">
                      ComfyNode Sentinel v{pkg.version} is fully up to date.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Modal
          </button>
        </div>
      </div>
    </div>
  );
}
