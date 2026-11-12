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
  Server,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { InstalledNode, ComfyLockfile, ReconciliationItem } from '@/types';
import {
  generateComfyLockfile,
  exportAsPlainUrls,
  calculateReconciliation,
  generateCloudPodBootstrapScript,
} from '@/lib/lockfile';

interface LockfileViewProps {
  installedNodes: InstalledNode[];
  onApplyReconciliation: (items: ReconciliationItem[]) => void;
}

export function LockfileView({
  installedNodes,
  onApplyReconciliation,
}: LockfileViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'export' | 'import_diff' | 'cloud_pod'>('export');
  const [copiedLockfile, setCopiedLockfile] = useState(false);
  const [copiedUrls, setCopiedUrls] = useState(false);
  const [copiedBootstrap, setCopiedBootstrap] = useState(false);
  const [copiedCurlCommand, setCopiedCurlCommand] = useState(false);
  const [importedJsonText, setImportedJsonText] = useState('');
  const [targetPodDir, setTargetPodDir] = useState('/workspace/ComfyUI');
  const [targetPodPort, setTargetPodPort] = useState(8188);
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

  const cloudPodBootstrapScript = generateCloudPodBootstrapScript(currentLockfile, {
    targetDir: targetPodDir,
    port: targetPodPort,
    listenAll: true,
  });

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

  const handleCopyBootstrap = () => {
    navigator.clipboard.writeText(cloudPodBootstrapScript);
    setCopiedBootstrap(true);
    setTimeout(() => setCopiedBootstrap(false), 2000);
  };

  const handleDownloadBootstrap = () => {
    const blob = new Blob([cloudPodBootstrapScript], { type: 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bootstrap.sh';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCurlCommand = () => {
    const cmd = `bash -c "$(cat << 'EOF'\n${cloudPodBootstrapScript}\nEOF\n)"`;
    navigator.clipboard.writeText(cmd);
    setCopiedCurlCommand(true);
    setTimeout(() => setCopiedCurlCommand(false), 2000);
  };

  const handleRunDiff = () => {
    setParseError(null);
    try {
      const parsed = JSON.parse(importedJsonText) as ComfyLockfile;
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error('Lockfile must contain a valid "nodes" array.');
      }
      const diff = calculateReconciliation(installedNodes, parsed);
      setReconciliationResult(diff);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON lockfile format.');
      setReconciliationResult(null);
    }
  };

  const handleLoadSampleLockfile = () => {
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
              <span>Portability &amp; Sync (Phase 4 &amp; 8)</span>
              <span aria-hidden="true">·</span>
              <span>The Lockfile Engine &amp; Cloud Pod Provisioner</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Environment Lockfile, 3-Way Sync &amp; Cloud Pods
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Guarantee 100% reproducible ComfyUI node environments across team machines, cloud GPU instances (RunPod, Vast.ai, Modal), and clean installs.
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
              Import &amp; 3-Way Diff
            </button>
            <button
              onClick={() => setActiveSubTab('cloud_pod')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeSubTab === 'cloud_pod'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Cloud Pod (bootstrap.sh)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: EXPORT SETUP */}
      {activeSubTab === 'export' && (
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

            <p className="text-xs text-slate-400 mt-2 mb-3">
              Full declarative specification with pinned Git commit hashes and enabled/disabled states.
            </p>

            <textarea
              readOnly
              value={lockfileString}
              className="flex-1 w-full min-h-[350px] p-3 font-mono text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg resize-none focus:outline-none select-all"
            />
          </div>

          {/* Plain urls.txt export */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  urls.txt (Plain Git URLs)
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

            <p className="text-xs text-slate-400 mt-2 mb-3">
              Lightweight URL list compatible with standard shell scripts and batch git cloners.
            </p>

            <textarea
              readOnly
              value={plainUrlsString}
              className="flex-1 w-full min-h-[350px] p-3 font-mono text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg resize-none focus:outline-none select-all"
            />
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: CLOUD POD BOOTSTRAPPER */}
      {activeSubTab === 'cloud_pod' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span>Headless Cloud Pod Provisioner (RunPod / Vast.ai / Modal)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Generates an idempotent bash script that installs ComfyUI, clones nodes at exact pinned commits, and applies headless Torch Shield protection.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCurlCommand}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800 rounded-lg transition-colors"
                >
                  {copiedCurlCommand ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Terminal className="w-3.5 h-3.5" />}
                  <span>{copiedCurlCommand ? 'Copied 1-Liner' : 'Copy Bash 1-Liner'}</span>
                </button>
                <button
                  onClick={handleCopyBootstrap}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-lg transition-colors"
                >
                  {copiedBootstrap ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedBootstrap ? 'Copied' : 'Copy Script'}</span>
                </button>
                <button
                  onClick={handleDownloadBootstrap}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm"
                >
                  <Download className="w-3 h-3" />
                  <span>Download bootstrap.sh</span>
                </button>
              </div>
            </div>

            {/* Quick Pod Configuration Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-2 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1 font-mono">
                  Container Target Path
                </label>
                <input
                  type="text"
                  value={targetPodDir}
                  onChange={(e) => setTargetPodDir(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1 font-mono">
                  Listening Port
                </label>
                <input
                  type="number"
                  value={targetPodPort}
                  onChange={(e) => setTargetPodPort(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Script Preview Box */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-300 mb-2 font-mono">
                Generated bootstrap.sh Preview
              </label>
              <textarea
                readOnly
                value={cloudPodBootstrapScript}
                className="w-full h-[400px] p-4 font-mono text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg resize-none focus:outline-none select-all leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: IMPORT & 3-WAY RECONCILIATION */}
      {activeSubTab === 'import_diff' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Paste Target comfy-lock.json
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste a lockfile from a teammate or repository to calculate a 3-way reconciliation diff.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadSampleLockfile}
                  className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded transition-colors"
                >
                  Load Sample Lockfile
                </button>
                <button
                  onClick={handleRunDiff}
                  disabled={!importedJsonText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Calculate Diff</span>
                </button>
              </div>
            </div>

            <textarea
              value={importedJsonText}
              onChange={(e) => setImportedJsonText(e.target.value)}
              placeholder='Paste target comfy-lock.json here or click "Load Sample Lockfile"...'
              className="w-full h-44 mt-4 p-3 font-mono text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg resize-none focus:outline-none focus:border-indigo-500"
            />

            {parseError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-950/40 border border-rose-900 text-rose-300 text-xs">
                ⚠️ {parseError}
              </div>
            )}
          </div>

          {/* Reconciliation Plan Results */}
          {reconciliationResult && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Reconciliation Action Plan ({reconciliationResult.items.length} items)
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs mt-1 font-mono">
                    <span className="text-emerald-400">
                      +{reconciliationResult.actionsCount.clone} to clone
                    </span>
                    <span className="text-amber-400">
                      ⚡{reconciliationResult.actionsCount.checkout} commit switches
                    </span>
                    <span className="text-indigo-400">
                      🔄{reconciliationResult.actionsCount.toggle_state} state toggles
                    </span>
                    <span className="text-slate-400">
                      ✓{reconciliationResult.actionsCount.in_sync} in-sync
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
