'use client';

import React, { useState } from 'react';
import {
  Search,
  Star,
  Download,
  Plus,
  FileText,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  History,
  Undo2,
  Copy,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { RegistryNode, InstalledNode, UpdateTransaction } from '@/types';
import { COMMUNITY_REGISTRY } from '@/lib/default-data';
import { generateGitBisectScript } from '@/lib/transaction-history';

type ActionResult = { ok: boolean; message: string } | void;

interface RegistryViewProps {
  installedNodes: InstalledNode[];
  transactions?: UpdateTransaction[];
  isValidRoot?: boolean;
  onNavigateToSettings?: () => void;
  onInstallFromRegistry: (regNode: RegistryNode) => Promise<ActionResult> | ActionResult;
  onInstallViaGitUrl: (url: string, branch?: string, folderName?: string) => Promise<ActionResult> | ActionResult;
  onBatchUrlImport: (urls: string[]) => Promise<ActionResult> | ActionResult;
  onCheckUpdates: () => Promise<ActionResult> | ActionResult;
  onUpdateAll: () => Promise<ActionResult> | ActionResult;
  onUpdateSingleNode?: (folderName: string) => Promise<ActionResult> | ActionResult;
  onRollbackTransaction?: (id: string) => void;
}

export function RegistryView({
  installedNodes,
  transactions = [],
  isValidRoot = true,
  onNavigateToSettings,
  onInstallFromRegistry,
  onInstallViaGitUrl,
  onBatchUrlImport,
  onCheckUpdates,
  onUpdateAll,
  onUpdateSingleNode,
  onRollbackTransaction,
}: RegistryViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'browse' | 'updates'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [copiedBisectId, setCopiedBisectId] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [updatingFolder, setUpdatingFolder] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'url' | 'batch' | 'check' | 'update' | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; message: string } | null>(null);

  // Direct Git URL modal state
  const [directUrl, setDirectUrl] = useState('');
  const [directBranch, setDirectBranch] = useState('');
  const [directFolder, setDirectFolder] = useState('');

  // Batch import state
  const [batchText, setBatchText] = useState(
    `# ComfyUI Custom Nodes Batch List\nhttps://github.com/rgthree/rgthree-comfy.git\nhttps://github.com/crystian/ComfyUI-Crystools.git\n# https://github.com/kijai/ComfyUI-SUPIR.git (Heavy upscaler)`
  );

  const categories = Array.from(new Set(COMMUNITY_REGISTRY.map((r) => r.category)));

  // Check if a registry node is installed
  const isInstalled = (gitUrl: string) => {
    const clean = gitUrl.replace(/\.git$/, '').toLowerCase();
    return installedNodes.some(
      (n) => n.gitUrl.replace(/\.git$/, '').toLowerCase() === clean
    );
  };

  const filteredRegistry = COMMUNITY_REGISTRY.filter((node) => {
    if (selectedCategory !== 'all' && node.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = node.name.toLowerCase().includes(q);
      const matchDesc = node.description.toLowerCase().includes(q);
      const matchAuthor = node.author.toLowerCase().includes(q);
      const matchClasses = node.nodeClasses.some((c) => c.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchAuthor && !matchClasses) return false;
    }
    return true;
  });

  const handleInstallCard = async (node: RegistryNode) => {
    setInstallingId(node.id);
    setStatusBanner(null);
    try {
      const res = await onInstallFromRegistry(node);
      if (res && typeof res === 'object') setStatusBanner(res);
    } finally {
      setInstallingId(null);
    }
  };

  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl.trim()) return;
    setBusyAction('url');
    setStatusBanner(null);
    try {
      const res = await onInstallViaGitUrl(
        directUrl.trim(),
        directBranch.trim() || undefined,
        directFolder.trim() || undefined
      );
      if (res && typeof res === 'object') setStatusBanner(res);
      setDirectUrl('');
      setDirectBranch('');
      setDirectFolder('');
      setShowUrlModal(false);
    } finally {
      setBusyAction(null);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = batchText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.startsWith('http'));

    if (urls.length > 0) {
      setBusyAction('batch');
      setStatusBanner(null);
      try {
        const res = await onBatchUrlImport(urls);
        if (res && typeof res === 'object') setStatusBanner(res);
      } finally {
        setBusyAction(null);
      }
    }
    setShowBatchModal(false);
  };

  const handleCheckUpdatesClick = async () => {
    setActiveSubTab('updates');
    setBusyAction('check');
    setStatusBanner(null);
    try {
      const res = await onCheckUpdates();
      setLastCheckedAt(new Date().toLocaleTimeString());
      if (res && typeof res === 'object') setStatusBanner(res);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateAllClick = async () => {
    setBusyAction('update');
    setStatusBanner(null);
    try {
      const res = await onUpdateAll();
      if (res && typeof res === 'object') setStatusBanner(res);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateSingleClick = async (folderName: string) => {
    if (!onUpdateSingleNode) return;
    setUpdatingFolder(folderName);
    setStatusBanner(null);
    try {
      const res = await onUpdateSingleNode(folderName);
      if (res && typeof res === 'object') setStatusBanner(res);
    } finally {
      setUpdatingFolder(null);
    }
  };

  const updatesAvailableCount = installedNodes.filter((n) => n.hasUpdate).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Ingestion Channels (Phase 3)</span>
              <span aria-hidden="true">·</span>
              <span>Curated Registry & Git Pipeline</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Community Node Registry & Ingestion
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Discover trusted community extensions, install via direct Git clone, or import batch lists with automated deduplication and Torch Shielding.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowUrlModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Install via URL</span>
            </button>

            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Batch URL Import</span>
            </button>

            <button
              onClick={handleCheckUpdatesClick}
              disabled={busyAction !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${busyAction === 'check' ? 'animate-spin' : ''}`} />
              <span>{busyAction === 'check' ? 'Checking...' : 'Check Updates'}</span>
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 rounded-lg transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>Rollback History ({transactions.length})</span>
            </button>

            <button
              onClick={handleUpdateAllClick}
              disabled={busyAction !== null}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors shadow-sm"
            >
              <RotateCw className={`w-3.5 h-3.5 ${busyAction === 'update' ? 'animate-spin' : ''}`} />
              <span>{busyAction === 'update' ? 'Updating...' : 'Update All Installed'}</span>
            </button>
          </div>
        </div>
      </div>

      {!isValidRoot && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>ComfyUI root directory is not configured on disk. Configure it in Settings before installing or updating nodes.</span>
          </div>
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0 transition-colors"
            >
              Open Settings
            </button>
          )}
        </div>
      )}

      {statusBanner && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 text-xs ${
            statusBanner.ok
              ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200'
              : 'border-rose-800/60 bg-rose-950/30 text-rose-200'
          }`}
        >
          <span>{statusBanner.message}</span>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
        <button
          onClick={() => setActiveSubTab('browse')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'browse'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Browse &amp; Install ({filteredRegistry.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('updates')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'updates'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Updates &amp; Rollback</span>
          {updatesAvailableCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
              {updatesAvailableCount}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'browse' && (
        <>
          {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search registry by name, author, or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing {filteredRegistry.length} community nodes
        </div>
      </div>

      {/* Registry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRegistry.map((node) => {
          const installed = isInstalled(node.gitUrl);

          return (
            <div
              key={node.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 transition-colors shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 hover:text-indigo-300 transition-colors">
                      {node.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                      <span>by @{node.author}</span>
                      <span aria-hidden="true">·</span>
                      <span>{node.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-amber-400 font-mono text-xs shrink-0">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{node.stars}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed line-clamp-2">
                  {node.description}
                </p>

                {/* Node classes provided */}
                <div className="mt-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
                    Provided Classes:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {node.nodeClasses.slice(0, 3).map((cls) => (
                      <span
                        key={cls}
                        className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400"
                      >
                        {cls}
                      </span>
                    ))}
                    {node.nodeClasses.length > 3 && (
                      <span className="text-[10px] text-slate-500 font-mono self-center">
                        +{node.nodeClasses.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/80">
                <a
                  href={node.gitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </a>

                {installed ? (
                  <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Installed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleInstallCard(node)}
                    disabled={installingId !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                  >
                    {installingId === node.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Cloning...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Install</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
          </div>
        </>
      )}

      {activeSubTab === 'updates' && (
        <div className="space-y-6">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-[11px] text-slate-400">Installed Nodes</div>
              <div className="text-xl font-bold text-white font-mono mt-1">{installedNodes.length}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-[11px] text-slate-400">Updates Available</div>
              <div className={`text-xl font-bold font-mono mt-1 ${updatesAvailableCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {updatesAvailableCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-[11px] text-slate-400">Rollback Points</div>
              <div className="text-xl font-bold text-indigo-300 font-mono mt-1">{transactions.length}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-[11px] text-slate-400">Last Remote Check</div>
              <div className="text-sm font-semibold text-slate-200 font-mono mt-1.5">
                {lastCheckedAt || 'Not checked yet'}
              </div>
            </div>
          </div>

          {/* Per-Node Update Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">
                Repository Upstream Status
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCheckUpdatesClick}
                  disabled={busyAction !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${busyAction === 'check' ? 'animate-spin' : ''}`} />
                  <span>{busyAction === 'check' ? 'Checking...' : 'Check Now'}</span>
                </button>
                {updatesAvailableCount > 0 && (
                  <button
                    onClick={handleUpdateAllClick}
                    disabled={busyAction !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Update All ({updatesAvailableCount})</span>
                  </button>
                )}
              </div>
            </div>

            {installedNodes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                No custom nodes found in custom_nodes/. Configure your ComfyUI path in Settings or install a node first.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {installedNodes.map((n) => (
                  <div
                    key={n.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-900/80"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100 font-mono truncate">
                          {n.folderName}
                        </span>
                        {!n.enabled && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">
                            disabled
                          </span>
                        )}
                        {n.hasUpdate ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-700/60 text-[10px] font-mono text-amber-300">
                            Update available
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-800/50 text-[10px] font-mono text-emerald-400">
                            Up to date
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-3">
                        <span>Branch: {n.branch || 'unknown'}</span>
                        <span>HEAD: {n.currentCommit || 'unknown'}</span>
                        {n.latestCommit && n.hasUpdate && (
                          <span className="text-amber-300">Upstream: {n.latestCommit}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {n.hasUpdate && onUpdateSingleNode && (
                        <button
                          onClick={() => handleUpdateSingleClick(n.folderName)}
                          disabled={updatingFolder !== null || busyAction !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          {updatingFolder === n.folderName ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Update</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rollback Ledger */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">
                  Recent Update Rollback History ({transactions.length})
                </h3>
              </div>
            </div>
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 font-mono">
                No update transactions recorded yet. Updating a node creates a 1-click git rollback point.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200 font-mono">
                        {tx.nodeFolderName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {tx.previousCommit} &rarr; {tx.targetCommit} &middot; {new Date(tx.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {onRollbackTransaction && tx.status === 'applied' && (
                      <button
                        onClick={() => onRollbackTransaction(tx.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 hover:text-white bg-amber-950/50 hover:bg-amber-900 border border-amber-800/60 rounded-lg transition-colors self-start sm:self-auto"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Rollback to {tx.previousCommit}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Git Clone Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">
              Install Custom Node via Git URL
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Clones repository via <code>git clone --depth 1</code> and feeds dependencies to the sequential pip queue.
            </p>

            <form onSubmit={handleDirectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Git Repository URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/author/ComfyUI-Node.git"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Branch / Tag (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="main, master, v1.0.0"
                    value={directBranch}
                    onChange={(e) => setDirectBranch(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Folder Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="ComfyUI-CustomName"
                    value={directFolder}
                    onChange={(e) => setDirectFolder(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
                >
                  Clone & Install
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Import Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">
              Batch URL Import (nodes.txt)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste multiple Git URLs (one per line). Comments starting with <code>#</code> are ignored. Deduplication runs automatically against installed nodes.
            </p>

            <form onSubmit={handleBatchSubmit} className="space-y-4">
              <div>
                <textarea
                  rows={6}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
                >
                  Start Batch Ingestion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Transaction History & Rollback Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  <span>Update Transaction History & Rollback Assistant</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Immutable audit log of all upstream updates. If an update introduces a breaking change or startup traceback, roll back immediately with 1 click.
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-500 hover:text-white text-xs px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No update transactions recorded yet.
                </div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-4 rounded-lg border border-slate-800 bg-slate-950/60 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-white font-mono">
                          {tx.nodeDisplayName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono ml-2">
                          ({tx.nodeFolderName})
                        </span>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Commit: <span className="text-slate-300">{tx.previousCommit}</span> →{' '}
                          <span className="text-indigo-400">{tx.targetCommit}</span> ·{' '}
                          <span>{new Date(tx.timestamp).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {tx.status === 'rolled_back' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Rolled Back
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active HEAD
                          </span>
                        )}

                        <button
                          onClick={() => {
                            const script = generateGitBisectScript(
                              tx.nodeFolderName,
                              tx.previousCommit,
                              tx.targetCommit
                            );
                            navigator.clipboard.writeText(script);
                            setCopiedBisectId(tx.id);
                            setTimeout(() => setCopiedBisectId(null), 2000);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                          title="Copy Git Bisect bash script to debug breaking commit range"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedBisectId === tx.id ? 'Copied Bisect!' : 'Bisect Script'}</span>
                        </button>

                        {onRollbackTransaction && (
                          <button
                            disabled={tx.status === 'rolled_back'}
                            onClick={() => onRollbackTransaction(tx.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                              tx.status === 'rolled_back'
                                ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                                : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80'
                            }`}
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Rollback</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
