'use client';

import React, { useState } from 'react';
import {
  FileCode2,
  Download,
  Copy,
  Check,
  Upload,
  RefreshCw,
  GitCommit,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { InstalledNode, ComfyLockfile, ReconciliationItem } from '@/types';
import {
  generateComfyLockfile,
  exportAsPlainUrls,
  calculateReconciliation,
} from '@/lib/lockfile';

interface LockfileViewProps {
  installedNodes: InstalledNode[];
  onApplyReconciliation: (items: ReconciliationItem[]) => void;
}

export function LockfileView({
  installedNodes,
  onApplyReconciliation,
}: LockfileViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'export' | 'import_diff'>('export');
  const [copiedLockfile, setCopiedLockfile] = useState(false);
  const [copiedUrls, setCopiedUrls] = useState(false);
  const [importedJsonText, setImportedJsonText] = useState('');
  const [reconciliationResult, setReconciliationResult] = useState<{
    items: ReconciliationItem[];
    actionsCount: {
      clone: number;
      checkout: number;
      toggle_state: number;
      keep_or_disable: number;
      in_sync: number;
    };
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const currentLockfile = generateComfyLockfile(installedNodes);
  const lockfileString = JSON.stringify(currentLockfile, null, 2);
  const plainUrlsString = exportAsPlainUrls(installedNodes);

  const handleCopyLockfile = () => {
    navigator.clipboard.writeText(lockfileString);
    setCopiedLockfile(true);
    setTimeout(() => setCopiedLockfile(false), 2000);
  };

  const handleDownloadLockfile = () => {
    const blob = new Blob([lockfileString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comfy-lock.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyUrls = () => {
    navigator.clipboard.writeText(plainUrlsString);
    setCopiedUrls(true);
    setTimeout(() => setCopiedUrls(false), 2000);
  };

  const handleDownloadUrls = () => {
    const blob = new Blob([plainUrlsString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urls.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunDiff = () => {
    setParseError(null);
    try {
      const parsed = JSON.parse(importedJsonText) as ComfyLockfile;
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error('Lockfile must contain a "nodes" array.');
      }
      const diff = calculateReconciliation(installedNodes, parsed);
      setReconciliationResult(diff);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON lockfile');
      setReconciliationResult(null);
    }
  };

  const handleLoadSampleLockfile = () => {
    // Generate a sample lockfile with simulated differences
    const sample: ComfyLockfile = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      comfyui_version: 'v0.3.18-cu124',
      nodes: [
        {
          name: 'ComfyUI-Manager',
          url: 'https://github.com/ltdrdata/ComfyUI-Manager.git',
          commit_hash: '9a4c8e1',
          branch: 'main',
          enabled_state: true,
        },
        {
          name: 'ComfyUI-Impact-Pack',
          url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack.git',
          commit_hash: '11aa22bb', // Different commit -> checkout
          branch: 'main',
          enabled_state: true,
        },
        {
          name: 'ComfyUI_IPAdapter_plus',
          url: 'https://github.com/cubiq/ComfyUI_IPAdapter_plus.git',
          commit_hash: '1b89ef3',
          branch: 'main',
          enabled_state: false, // State mismatch -> toggle to disabled
        },
        {
          name: 'ComfyUI-SUPIR', // Missing locally -> clone
          url: 'https://github.com/kijai/ComfyUI-SUPIR.git',
          commit_hash: '77bb99aa',
          branch: 'main',
          enabled_state: true,
        },
      ],
    };

    setImportedJsonText(JSON.stringify(sample, null, 2));
    const diff = calculateReconciliation(installedNodes, sample);
    setReconciliationResult(diff);
    setParseError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Portability & Sync (Phase 4)</span>
              <span aria-hidden="true">·</span>
              <span>The Lockfile Engine (comfy-lock.json)</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Environment Lockfile & 3-Way Sync
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Guarantee 100% reproducible ComfyUI node environments across team machines, cloud pods (RunPod/Vast.ai), and clean installs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('export')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeSubTab === 'export'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Export Setup
            </button>
            <button
              onClick={() => setActiveSubTab('import_diff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeSubTab === 'import_diff'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Import & 3-Way Diff
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'export' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* comfy-lock.json full export */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  comfy-lock.json (Pinned Commits)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLockfile}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded transition-colors"
                >
                  {copiedLockfile ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedLockfile ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadLockfile}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors shadow-sm"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 mb-3">
              Full specification recording folder names, git origins, exact commit hashes, and enabled states.
            </p>

            <pre className="flex-1 p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-y-auto max-h-[420px] select-all leading-relaxed">
              {lockfileString}
            </pre>
          </div>

          {/* urls.txt plain export */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  urls.txt (Lightweight Repo List)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyUrls}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded transition-colors"
                >
                  {copiedUrls ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedUrls ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadUrls}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors shadow-sm"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 mb-3">
              Plain text list of git URLs suitable for simple shell clone scripts or ComfyUI batch loaders.
            </p>

            <pre className="flex-1 p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-y-auto max-h-[420px] select-all leading-relaxed">
              {plainUrlsString}
            </pre>
          </div>
        </div>
      ) : (
        /* Import & 3-Way Diff Section */
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  Target comfy-lock.json Input
                </h3>
              </div>

              <button
                onClick={handleLoadSampleLockfile}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                Load Sample Multi-Machine Lockfile
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-2 mb-3">
              Paste a <code>comfy-lock.json</code> file to calculate a 3-way diff (missing nodes, commit drift, extra local nodes, enabled states).
            </p>

            <textarea
              rows={6}
              placeholder="Paste comfy-lock.json here..."
              value={importedJsonText}
              onChange={(e) => setImportedJsonText(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />

            {parseError && (
              <div className="text-xs text-rose-400 font-mono mt-2">
                {parseError}
              </div>
            )}

            <div className="flex justify-end mt-3">
              <button
                onClick={handleRunDiff}
                disabled={!importedJsonText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Calculate 3-Way Reconciliation Diff</span>
              </button>
            </div>
          </div>

          {/* Reconciliation Plan Preview */}
          {reconciliationResult && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Reconciliation Action Plan
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                    <span className="text-emerald-400">
                      Clone: {reconciliationResult.actionsCount.clone}
                    </span>
                    <span className="text-amber-400">
                      Checkout: {reconciliationResult.actionsCount.checkout}
                    </span>
                    <span className="text-indigo-400">
                      Toggle State: {reconciliationResult.actionsCount.toggle_state}
                    </span>
                    <span className="text-slate-400">
                      In-Sync: {reconciliationResult.actionsCount.in_sync}
                    </span>
                    <span className="text-slate-500">
                      Extra Local: {reconciliationResult.actionsCount.keep_or_disable}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onApplyReconciliation(reconciliationResult.items)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Execute Reconciliation Plan</span>
                </button>
              </div>

              {/* Items Table */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-medium">
                      <th className="py-2.5 px-3">Node</th>
                      <th className="py-2.5 px-3">Action Required</th>
                      <th className="py-2.5 px-3">Details / Reconciliation Plan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {reconciliationResult.items.map((item, idx) => {
                      let actionColor = 'text-slate-400';
                      if (item.action === 'clone') actionColor = 'text-emerald-400 font-semibold';
                      if (item.action === 'checkout') actionColor = 'text-amber-400 font-semibold';
                      if (item.action === 'toggle_state') actionColor = 'text-indigo-400 font-semibold';
                      if (item.action === 'keep_or_disable') actionColor = 'text-purple-400';

                      return (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {item.name}
                          </td>
                          <td className={`py-2.5 px-3 uppercase ${actionColor}`}>
                            {item.action.replace('_', ' ')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-sans text-xs">
                            {item.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
