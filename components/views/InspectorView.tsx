'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Search,
  Check,
  Copy,
  ExternalLink,
  Trash2,
  RotateCcw,
  GitBranch,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wand2,
  HardDrive,
  BarChart3,
  PieChart,
  X,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PowerOff,
  FileText,
  RefreshCw,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
} from 'recharts';
import { InstalledNode } from '@/types';

interface CategoryChartDatum {
  category: string;
  count: number;
  totalMb: number;
  percentage: number;
  sizePercentage: number;
  color: string;
}

function CategoryTooltipContent({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CategoryChartDatum }>;
  metric: 'count' | 'size';
}) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-[11px] shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-2 font-semibold text-white">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
        <span>{d.category}</span>
      </div>
      <div className="mt-1 font-mono tabular-nums text-slate-300">
        {metric === 'count' ? (
          <span>
            {d.count} {d.count === 1 ? 'node' : 'nodes'} ({d.percentage}%) · {d.totalMb} MB
          </span>
        ) : (
          <span>
            {d.totalMb} MB ({d.sizePercentage}%) · {d.count} {d.count === 1 ? 'node' : 'nodes'}
          </span>
        )}
      </div>
    </div>
  );
}

interface InspectorViewProps {
  nodes: InstalledNode[];
  trashNodes: InstalledNode[];
  showCleanNames: boolean;
  setShowCleanNames: (show: boolean) => void;
  aliases: Record<string, string>;
  onUpdateAlias: (folderName: string, alias: string) => void;
  onToggleNodeState: (folderName: string) => void;
  onDisableAllNodes?: () => void;
  onUpdateSingleNode?: (folderName: string) => Promise<{ ok: boolean; message: string } | void> | void;
  onForceReinstallNode?: (node: InstalledNode) => Promise<void> | void;
  onReadNodeReadme?: (
    node: InstalledNode
  ) => Promise<{ content: string; fileName: string; source: string; error?: string }>;
  onUninstallNode: (folderName: string) => void;
  onRestoreNode: (folderName: string) => void;
  onNormalizeBatch: (replacements: { original: string; proposed: string }[]) => void;
  onNavigateToDoctor: (nodeId: string) => void;
  onNavigateToRunner: (commandText: string) => void;
}

export function InspectorView({
  nodes,
  trashNodes,
  showCleanNames,
  setShowCleanNames,
  aliases,
  onUpdateAlias,
  onToggleNodeState,
  onDisableAllNodes,
  onUpdateSingleNode,
  onForceReinstallNode,
  onReadNodeReadme,
  onUninstallNode,
  onRestoreNode,
  onNormalizeBatch,
  onNavigateToDoctor,
  onNavigateToRunner,
}: InspectorViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled' | 'updates'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [copiedCommit, setCopiedCommit] = useState<string | null>(null);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showNormalizerModal, setShowNormalizerModal] = useState(false);
  const [editingAliasFolder, setEditingAliasFolder] = useState<string | null>(null);
  const [aliasInputValue, setAliasInputValue] = useState('');
  const [repoLimit, setRepoLimit] = useState<number>(5);
  const [pieMetric, setPieMetric] = useState<'count' | 'size'>('count');
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'size' | 'health'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState<boolean>(true);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [reinstallingFolder, setReinstallingFolder] = useState<string | null>(null);
  const [updatingFolder, setUpdatingFolder] = useState<string | null>(null);
  const [readmeModal, setReadmeModal] = useState<{
    node: InstalledNode;
    loading: boolean;
    content: string;
    fileName: string;
    source: string;
    error?: string;
  } | null>(null);
  const [copiedReadme, setCopiedReadme] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Categories
  const categories = Array.from(new Set(nodes.map((n) => n.category))).filter(Boolean);

  // Storage calculation summing sizeMb across all installed nodes
  const totalDiskMb = React.useMemo(
    () => Math.round(nodes.reduce((acc, n) => acc + (Number(n.sizeMb) || 0), 0) * 10) / 10,
    [nodes]
  );

  const formatStorage = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const totalFiles = React.useMemo(
    () => nodes.reduce((acc, n) => acc + (n.filesCount || 0), 0),
    [nodes]
  );
  const activeCount = nodes.filter((n) => n.enabled).length;
  const disabledCount = nodes.filter((n) => !n.enabled).length;
  const updatesCount = nodes.filter((n) => n.hasUpdate).length;

  // Category Distribution & Color Map
  const categoryStats = React.useMemo(() => {
    const map = new Map<string, { count: number; totalMb: number }>();
    for (const node of nodes) {
      const cat = node.category || 'Uncategorized';
      const existing = map.get(cat) || { count: 0, totalMb: 0 };
      map.set(cat, {
        count: existing.count + 1,
        totalMb: existing.totalMb + (node.sizeMb || 0),
      });
    }

    const colorPalette = [
      '#6366f1', // indigo
      '#06b6d4', // cyan
      '#10b981', // emerald
      '#f59e0b', // amber
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f43f5e', // rose
      '#64748b', // slate
    ];

    return Array.from(map.entries())
      .map(([category, data], idx) => ({
        category,
        count: data.count,
        totalMb: Math.round(data.totalMb * 10) / 10,
        percentage: nodes.length > 0 ? Math.round((data.count / nodes.length) * 100) : 0,
        sizePercentage: totalDiskMb > 0 ? Math.round((data.totalMb / totalDiskMb) * 100) : 0,
        color: colorPalette[idx % colorPalette.length],
      }))
      .sort((a, b) =>
        pieMetric === 'count'
          ? b.count - a.count || b.totalMb - a.totalMb
          : b.totalMb - a.totalMb
      );
  }, [nodes, totalDiskMb, pieMetric]);

  // Disk Space Usage per Repository (ranked descending)
  const reposBySize = React.useMemo(() => {
    return [...nodes].sort((a, b) => (b.sizeMb || 0) - (a.sizeMb || 0));
  }, [nodes]);

  const maxRepoSizeMb = reposBySize[0]?.sizeMb || 1;

  // Normalizer candidates
  const normalizerCandidates = nodes.filter(
    (n) => n.normalizedProposedName && n.normalizedProposedName !== n.folderName
  );

  const filteredNodes = nodes.filter((node) => {
    if (statusFilter === 'enabled' && !node.enabled) return false;
    if (statusFilter === 'disabled' && node.enabled) return false;
    if (statusFilter === 'updates' && !node.hasUpdate) return false;
    if (categoryFilter !== 'all' && node.category !== categoryFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = node.folderName.toLowerCase().includes(q);
      const matchClean = (aliases[node.folderName] || node.cleanDisplayName).toLowerCase().includes(q);
      const matchAuthor = (node.author || '').toLowerCase().includes(q);
      const matchCategory = (node.category || '').toLowerCase().includes(q);
      const matchDesc = node.description.toLowerCase().includes(q);
      const matchClasses = node.providesNodes.some((cls) => cls.toLowerCase().includes(q));
      if (!matchName && !matchClean && !matchAuthor && !matchCategory && !matchDesc && !matchClasses) {
        return false;
      }
    }
    return true;
  });

  const sortedNodes = React.useMemo(() => {
    return [...filteredNodes].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        const nameA = aliases[a.folderName] || a.cleanDisplayName;
        const nameB = aliases[b.folderName] || b.cleanDisplayName;
        cmp = nameA.localeCompare(nameB);
      } else if (sortField === 'size') {
        cmp = (a.sizeMb || 0) - (b.sizeMb || 0);
      } else if (sortField === 'health') {
        cmp = a.healthStatus.localeCompare(b.healthStatus);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredNodes, sortField, sortAsc, aliases]);

  const handleSort = (field: 'name' | 'size' | 'health') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedNodeIds.size === filteredNodes.length) {
      setSelectedNodeIds(new Set());
    } else {
      setSelectedNodeIds(new Set(filteredNodes.map((n) => n.id)));
    }
  };

  const handleToggleSelectNode = (id: string) => {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [massActionMessage, setMassActionMessage] = useState<string | null>(null);

  const handleBatchToggleState = (targetEnabled: boolean) => {
    for (const node of nodes) {
      if (selectedNodeIds.has(node.id) && node.enabled !== targetEnabled) {
        onToggleNodeState(node.folderName);
      }
    }
  };

  const handleDisableAllNodesClick = () => {
    const previouslyActiveCount = nodes.filter((n) => n.enabled).length;
    if (onDisableAllNodes) {
      onDisableAllNodes();
    } else {
      for (const node of nodes) {
        if (node.enabled) {
          onToggleNodeState(node.folderName);
        }
      }
    }
    setMassActionMessage(
      `[Batch State Toggle] Disabled all ${previouslyActiveCount} active nodes (${nodes.length} total repositories set to .disabled) and logged to Runner console.`
    );
  };

  const drawerNode = nodes.find((n) => n.id === drawerNodeId) || null;
  const contextMenuNode = contextMenu ? nodes.find((n) => n.id === contextMenu.nodeId) || null : null;

  useEffect(() => {
    if (!contextMenu) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    const handleViewportChange = () => {
      setContextMenu(null);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [contextMenu]);

  const normalizeGitHubHref = (gitUrl: string): string | null => {
    const trimmed = (gitUrl || '').trim();
    if (!trimmed) return null;
    const normalized = trimmed
      .replace(/^git@github\.com:/i, 'https://github.com/')
      .replace(/\.git$/i, '');
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized;
    }
    return null;
  };

  const handleOpenContextMenu = (e: React.MouseEvent, node: InstalledNode) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 240;
    const menuHeight = 290;
    const clampedX = Math.min(e.clientX, Math.max(8, window.innerWidth - menuWidth - 8));
    const clampedY = Math.min(e.clientY, Math.max(8, window.innerHeight - menuHeight - 8));

    setContextMenu({
      x: clampedX,
      y: clampedY,
      nodeId: node.id,
    });
  };

  const handleViewReadme = async (node: InstalledNode) => {
    setContextMenu(null);
    setReadmeModal({
      node,
      loading: true,
      content: '',
      fileName: 'README.md',
      source: 'Reading repository documentation...',
    });

    if (onReadNodeReadme) {
      const result = await onReadNodeReadme(node);
      setReadmeModal({
        node,
        loading: false,
        content: result.content,
        fileName: result.fileName,
        source: result.source,
        error: result.error,
      });
      return;
    }

    const fallback = [
      `# ${aliases[node.folderName] || node.cleanDisplayName}`,
      '',
      node.description || 'No description provided.',
      '',
      `- Folder: ${node.folderName}`,
      `- Author: @${node.author}`,
      `- Category: ${node.category}`,
      `- Git URL: ${node.gitUrl}`,
    ].join('\n');

    setReadmeModal({
      node,
      loading: false,
      content: fallback,
      fileName: 'README.md',
      source: 'Indexed repository metadata',
    });
  };

  const handleForceReinstall = async (node: InstalledNode) => {
    setContextMenu(null);
    if (onForceReinstallNode) {
      setReinstallingFolder(node.folderName);
      setMassActionMessage(`[Force Reinstall] Reinstalling ${node.folderName} and verifying dependencies...`);
      try {
        await onForceReinstallNode(node);
        setMassActionMessage(
          `[Force Reinstall] Completed force reinstall pipeline for ${node.folderName}.`
        );
      } finally {
        setReinstallingFolder(null);
      }
      return;
    }

    onNavigateToRunner(
      `git -C custom_nodes/${node.folderName} fetch --all && git -C custom_nodes/${node.folderName} reset --hard HEAD && pip install -r custom_nodes/${node.folderName}/requirements.txt`
    );
  };

  const handleCopyCommit = (commit: string) => {
    navigator.clipboard.writeText(commit);
    setCopiedCommit(commit);
    setTimeout(() => setCopiedCommit(null), 2000);
  };

  const handleStartEditAlias = (folder: string, current: string) => {
    setEditingAliasFolder(folder);
    setAliasInputValue(aliases[folder] || current);
  };

  const handleSaveAlias = (folder: string) => {
    if (aliasInputValue.trim()) {
      onUpdateAlias(folder, aliasInputValue.trim());
    }
    setEditingAliasFolder(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Local Inspector & Disk Manager</span>
              <span aria-hidden="true">·</span>
              <span>custom_nodes/</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Installed Custom Nodes
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Inspect git origins, commit hashes, toggle enabled/disabled states without deletion, and normalize naming conventions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Storage Usage Summary Component */}
            <div
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs shadow-sm"
              title={`Total storage footprint across ${nodes.length} installed custom node repositories`}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/20 text-indigo-400 shrink-0">
                <HardDrive className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-[11px] text-slate-400 font-sans font-medium">Storage Usage:</span>
                <span className="font-bold text-slate-100 tabular-nums text-xs">
                  {formatStorage(totalDiskMb)}
                </span>
                <span className="text-[10px] text-slate-500 font-sans">
                  ({nodes.length} repos)
                </span>
              </div>
            </div>

            {/* Clean vs Real Names Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <span className="text-slate-400 text-[11px]">Display:</span>
              <button
                onClick={() => setShowCleanNames(!showCleanNames)}
                className="font-medium text-indigo-300 hover:text-indigo-200"
              >
                {showCleanNames ? 'Clean Display Names' : 'Real Folder Names'}
              </button>
            </div>

            {/* Disable All Nodes Batch Button */}
            <button
              type="button"
              onClick={handleDisableAllNodesClick}
              disabled={activeCount === 0}
              title={
                activeCount === 0
                  ? 'All custom nodes are already disabled'
                  : `Disable all ${activeCount} active custom node repositories`
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <PowerOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Disable All Nodes</span>
            </button>

            {/* Folder Normalizer Button */}
            <button
              onClick={() => setShowNormalizerModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Normalizer Tool ({normalizerCandidates.length})</span>
            </button>

            {/* Storage Charts Toggle */}
            <button
              onClick={() => setShowCharts((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                showCharts
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{showCharts ? 'Hide Charts' : 'Storage Charts'}</span>
            </button>

            {/* Safe Trash Bin */}
            <button
              onClick={() => setShowTrashModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Trash Bin ({trashNodes.length})</span>
            </button>
          </div>
        </div>

        {massActionMessage && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3.5 py-2 text-xs text-amber-200 font-mono">
            <span>{massActionMessage}</span>
            <button
              type="button"
              onClick={() => setMassActionMessage(null)}
              className="text-amber-400 hover:text-white transition-colors"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800/80 text-xs">
          <div>
            <div className="text-slate-500 text-[11px]">Total Storage Footprint</div>
            <div className="text-lg font-bold text-slate-100 font-mono mt-0.5 tabular-nums">
              {formatStorage(totalDiskMb)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {totalFiles.toLocaleString()} files tracked
            </div>
          </div>

          <div>
            <div className="text-slate-500 text-[11px]">Installed Repositories</div>
            <div className="text-lg font-bold text-slate-100 font-mono mt-0.5 tabular-nums">
              {nodes.length} Repos
            </div>
            <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
              {activeCount} active · {disabledCount} disabled
            </div>
          </div>

          <div>
            <div className="text-slate-500 text-[11px]">Health Compliance</div>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5 tabular-nums">
              {nodes.filter((n) => n.healthStatus === 'compliant').length} Compliant
            </div>
            <div className="text-[11px] text-amber-400 font-mono mt-0.5">
              {nodes.filter((n) => n.healthStatus === 'fragile').length} fragile · {nodes.filter((n) => n.healthStatus === 'os_locked').length} os-locked
            </div>
          </div>

          <div>
            <div className="text-slate-500 text-[11px]">Updates Pending</div>
            <div className={`text-lg font-bold font-mono mt-0.5 tabular-nums ${updatesCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {updatesCount} Available
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Upstream git tracking
            </div>
          </div>
        </div>

        {/* Always-Visible Disk Space Allocation Progress Bar */}
        {nodes.length > 0 && (() => {
          const activeMb = Math.round(
            nodes.filter((n) => n.enabled).reduce((acc, n) => acc + (Number(n.sizeMb) || 0), 0) * 10
          ) / 10;
          const disabledMb = Math.max(0, Math.round((totalDiskMb - activeMb) * 10) / 10);
          const activePct = totalDiskMb > 0 ? Math.round((activeMb / totalDiskMb) * 100) : 0;
          const disabledPct = Math.max(0, 100 - activePct);
          const topSharePct = totalDiskMb > 0 && reposBySize[0] ? Math.round((reposBySize[0].sizeMb / totalDiskMb) * 100) : 0;

          return (
            <div className="mt-5 pt-4 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mb-2">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  <span>custom_nodes/ Directory Disk Space Usage</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Active: {formatStorage(activeMb)} ({activePct}%)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span>Disabled: {formatStorage(disabledMb)} ({disabledPct}%)</span>
                  </span>
                  {reposBySize[0] && (
                    <span className="text-indigo-300">
                      Top: {reposBySize[0].folderName} ({topSharePct}%)
                    </span>
                  )}
                </div>
              </div>
              <div
                className="h-2.5 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex"
                role="progressbar"
                aria-label="Custom node directory disk space usage"
                aria-valuenow={activePct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {activeMb > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${activePct}%` }}
                    title={`Active custom nodes: ${formatStorage(activeMb)} (${activePct}%)`}
                  />
                )}
                {disabledMb > 0 && (
                  <div
                    className="h-full bg-slate-600/80 transition-all duration-300"
                    style={{ width: `${disabledPct}%` }}
                    title={`Disabled custom nodes: ${formatStorage(disabledMb)} (${disabledPct}%)`}
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* Mini Charts Visualization Panel (Collapsible) */}
        {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-800/80">
          {/* Mini Chart 1: Recharts Category Distribution Chart */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/70">
                <div className="flex items-center gap-2">
                  <PieChart className="w-3.5 h-3.5 text-indigo-400" />
                  <h3 className="text-xs font-semibold text-slate-200">
                    Node Library Distribution by Category
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Chart Type Toggle: Bar vs Pie */}
                  <div className="flex items-center gap-1 text-[11px] bg-slate-900 rounded p-0.5 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setChartType('bar')}
                      className={`px-2 py-0.5 rounded font-mono transition-colors ${
                        chartType === 'bar'
                          ? 'bg-slate-800 text-indigo-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Bar
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('pie')}
                      className={`px-2 py-0.5 rounded font-mono transition-colors ${
                        chartType === 'pie'
                          ? 'bg-slate-800 text-indigo-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Pie
                    </button>
                  </div>

                  {/* Metric Mode Toggle: Count vs Disk Size */}
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPieMetric('count')}
                      className={`px-2 py-0.5 rounded font-mono ${
                        pieMetric === 'count'
                          ? 'bg-slate-800 text-indigo-300 border border-slate-700'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Count
                    </button>
                    <button
                      type="button"
                      onClick={() => setPieMetric('size')}
                      className={`px-2 py-0.5 rounded font-mono ${
                        pieMetric === 'size'
                          ? 'bg-slate-800 text-indigo-300 border border-slate-700'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Size (MB)
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 mb-3">
                {pieMetric === 'count' ? 'Number of installed custom nodes' : 'Storage footprint (MB)'} per category. Click any bar, slice, or legend item to filter.
              </p>

              {categoryStats.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-500 font-mono">
                  No category data available.
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4 mt-1">
                  {/* Recharts Responsive Chart */}
                  <div className="w-full sm:w-[58%] h-44 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'bar' ? (
                        <BarChart
                          data={categoryStats}
                          margin={{ top: 6, right: 8, left: -24, bottom: 2 }}
                        >
                          <XAxis
                            dataKey="category"
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                            axisLine={{ stroke: '#1e293b' }}
                            tickLine={false}
                            interval={0}
                            tickFormatter={(val: string) =>
                              val.length > 9 ? `${val.slice(0, 8)}…` : val
                            }
                          />
                          <YAxis
                            allowDecimals={pieMetric === 'size'}
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <RechartsTooltip
                            cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                            content={<CategoryTooltipContent metric={pieMetric} />}
                          />
                          <Bar
                            dataKey={pieMetric === 'count' ? 'count' : 'totalMb'}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={36}
                            onClick={(entry) => {
                              const cat = (entry as unknown as { category?: string })?.category;
                              if (cat) {
                                setCategoryFilter(categoryFilter === cat ? 'all' : cat);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            {categoryStats.map((entry) => {
                              const isSelected = categoryFilter === entry.category;
                              const isDimmed =
                                (categoryFilter !== 'all' && !isSelected) ||
                                (hoveredCategory !== null && hoveredCategory !== entry.category);
                              return (
                                <Cell
                                  key={entry.category}
                                  fill={entry.color}
                                  fillOpacity={isDimmed ? 0.35 : 1}
                                  stroke={isSelected ? '#ffffff' : 'none'}
                                  strokeWidth={isSelected ? 1.5 : 0}
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      ) : (
                        <RechartsPieChart>
                          <Pie
                            data={categoryStats}
                            dataKey={pieMetric === 'count' ? 'count' : 'totalMb'}
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            innerRadius={36}
                            outerRadius={66}
                            paddingAngle={2}
                            stroke="#070a0f"
                            strokeWidth={1.5}
                            onClick={(entry) => {
                              const cat = (entry as unknown as { category?: string })?.category;
                              if (cat) {
                                setCategoryFilter(categoryFilter === cat ? 'all' : cat);
                              }
                            }}
                            className="cursor-pointer focus:outline-none"
                          >
                            {categoryStats.map((entry) => {
                              const isSelected = categoryFilter === entry.category;
                              const isDimmed =
                                (categoryFilter !== 'all' && !isSelected) ||
                                (hoveredCategory !== null && hoveredCategory !== entry.category);
                              return (
                                <Cell
                                  key={entry.category}
                                  fill={entry.color}
                                  fillOpacity={isDimmed ? 0.35 : 1}
                                />
                              );
                            })}
                          </Pie>
                          <RechartsTooltip
                            content={<CategoryTooltipContent metric={pieMetric} />}
                          />
                        </RechartsPieChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Category Legend & Breakdown List */}
                  <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5 flex-1 w-full max-h-44 overflow-y-auto pr-1">
                    {categoryStats.map((cat) => {
                      const isSelected = categoryFilter === cat.category;
                      const isHovered = hoveredCategory === cat.category;

                      return (
                        <button
                          key={cat.category}
                          type="button"
                          onMouseEnter={() => setHoveredCategory(cat.category)}
                          onMouseLeave={() => setHoveredCategory(null)}
                          onClick={() =>
                            setCategoryFilter(isSelected ? 'all' : cat.category)
                          }
                          className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                            isSelected
                              ? 'bg-slate-800/90 border border-slate-700'
                              : isHovered
                              ? 'bg-slate-900 border border-slate-700/60'
                              : 'hover:bg-slate-900/80 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-[11px] font-medium text-slate-200 truncate">
                              {cat.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                            {pieMetric === 'count'
                              ? `${cat.count} (${cat.percentage}%)`
                              : `${cat.totalMb}MB`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stacked Proportional Bar Indicator Below Chart */}
              <div className="mt-4 pt-3 border-t border-slate-800/60">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                  <span>Proportional Footprint</span>
                  <span>{nodes.length} nodes · {totalDiskMb} MB total</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                  {categoryStats.map((cat) => (
                    <button
                      key={cat.category}
                      type="button"
                      onMouseEnter={() => setHoveredCategory(cat.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() =>
                        setCategoryFilter(categoryFilter === cat.category ? 'all' : cat.category)
                      }
                      title={`${cat.category}: ${cat.count} nodes (${cat.percentage}%), ${cat.totalMb} MB`}
                      style={{
                        width: `${Math.max(pieMetric === 'count' ? cat.percentage : cat.sizePercentage, 3)}%`,
                        backgroundColor: cat.color,
                      }}
                      className="h-full transition-opacity hover:opacity-85 focus:outline-none"
                    />
                  ))}
                </div>
              </div>
            </div>

            {categoryFilter !== 'all' && (
              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-indigo-300 font-mono">
                  Filtering by: <strong>{categoryFilter}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className="text-slate-400 hover:text-white"
                >
                  Clear Filter
                </button>
              </div>
            )}
          </div>

          {/* Mini Chart 2: Disk Space Usage per Repository */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-slate-200">
                    Disk Space Usage per Repository
                  </h3>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    onClick={() => setRepoLimit(5)}
                    className={`px-2 py-0.5 rounded font-mono ${
                      repoLimit === 5
                        ? 'bg-slate-800 text-indigo-300 border border-slate-700'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Top 5
                  </button>
                  <button
                    onClick={() => setRepoLimit(nodes.length)}
                    className={`px-2 py-0.5 rounded font-mono ${
                      repoLimit > 5
                        ? 'bg-slate-800 text-indigo-300 border border-slate-700'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({nodes.length})
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 mb-3">
                Ranked by disk footprint in <code>custom_nodes/</code>. Click a repository to search in the table.
              </p>

              {/* Horizontal Ranked Bars */}
              <div className="space-y-2 mt-1">
                {reposBySize.slice(0, repoLimit).map((repo) => {
                  const displayName = showCleanNames
                    ? aliases[repo.folderName] || repo.cleanDisplayName
                    : repo.folderName;
                  const percentOfTotal = totalDiskMb > 0 ? Math.round((repo.sizeMb / totalDiskMb) * 100) : 0;
                  const barWidthPercent = Math.max(Math.round((repo.sizeMb / maxRepoSizeMb) * 100), 4);

                  return (
                    <button
                      key={repo.id}
                      onClick={() => setSearchQuery(repo.folderName)}
                      className="w-full group text-left focus:outline-none"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-medium text-slate-300 group-hover:text-indigo-300 transition-colors truncate max-w-[240px]">
                          {displayName}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-slate-400 shrink-0">
                          <span className="text-slate-200 font-semibold">{repo.sizeMb} MB</span>
                          <span className="text-slate-500">({percentOfTotal}%)</span>
                        </div>
                      </div>

                      {/* Bar indicator */}
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300 group-hover:brightness-125"
                          style={{ width: `${barWidthPercent}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Largest: {reposBySize[0]?.folderName} ({reposBySize[0]?.sizeMb} MB)</span>
              <span>Avg: {nodes.length > 0 ? Math.round((totalDiskMb / nodes.length) * 10) / 10 : 0} MB / repo</span>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Search Input (Name, Author, Category, or Node Class) */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                aria-label="Search installed nodes by name, author, or category"
                placeholder="Search by name, author, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search query"
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Dropdown */}
            <div className="relative flex items-center">
              <Filter className="absolute left-3 w-3.5 h-3.5 text-indigo-400 pointer-events-none" />
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto pl-8 pr-8 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="all">All Categories ({nodes.length})</option>
                {categories.map((c) => {
                  const count = nodes.filter((n) => n.category === c).length;
                  return (
                    <option key={c} value={c}>
                      {c} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {(searchQuery.trim() !== '' || categoryFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              Showing <strong className="text-slate-200">{filteredNodes.length}</strong> of {nodes.length} nodes
            </span>

            {/* Table vs Cards View Toggle */}
            <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table view"
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Card grid view"
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('enabled')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === 'enabled' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('disabled')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === 'disabled' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Disabled
              </button>
              <button
                onClick={() => setStatusFilter('updates')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === 'updates' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Updates
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Nodes List (Table or Cards, both support right-click Context Menu) */}
      {viewMode === 'cards' ? (
        sortedNodes.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 py-12 text-center text-xs text-slate-500">
            No custom nodes matched your criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedNodes.map((node) => {
              const displayName = showCleanNames
                ? aliases[node.folderName] || node.cleanDisplayName
                : node.folderName;
              const isContextTarget = contextMenu?.nodeId === node.id;

              return (
                <div
                  key={node.id}
                  onContextMenu={(e) => handleOpenContextMenu(e, node)}
                  className={`rounded-xl border p-4 transition-colors cursor-context-menu flex flex-col justify-between gap-4 ${
                    isContextTarget
                      ? 'border-indigo-500 bg-indigo-950/30 shadow-lg'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  } ${!node.enabled ? 'opacity-65' : ''}`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-semibold text-sm text-slate-100 hover:text-indigo-300 cursor-pointer truncate"
                            onClick={() => setDrawerNodeId(node.id)}
                          >
                            {displayName}
                          </span>
                          {node.hasUpdate && (
                            <span className="text-[10px] font-mono text-amber-400 shrink-0">Update</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                          <span className="truncate max-w-[180px]">
                            {node.folderName.replace(/\.disabled$/i, '')}
                            {!node.enabled ? '.disabled' : ''}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>@{node.author}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-indigo-400/90">{node.category}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => onToggleNodeState(node.folderName)}
                        title={node.enabled ? 'Click to disable' : 'Click to enable'}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          node.enabled ? 'bg-indigo-600' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            node.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                      {node.description || 'Custom node repository installed in custom_nodes/.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/70 space-y-2 text-[11px] font-mono text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>{node.currentCommit.slice(0, 7)}</span>
                      <span className="tabular-nums text-slate-300">
                        {node.sizeMb} MB ({totalDiskMb > 0 ? Math.round((node.sizeMb / totalDiskMb) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300"
                        style={{
                          width: `${Math.max(Math.round(((node.sizeMb || 0) / maxRepoSizeMb) * 100), 4)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans">
                      <span>{node.filesCount} files</span>
                      <span>Right-click for actions</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/70 bg-slate-950/30 text-[11px] text-slate-500">
            <span>Right-click any node row for quick actions (Open in GitHub, View Readme, Force Reinstall, Toggle Visibility)</span>
            <span className="font-mono tabular-nums">{sortedNodes.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/40 text-xs font-medium text-slate-400">
                  <th className="py-3 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={filteredNodes.length > 0 && selectedNodeIds.size === filteredNodes.length}
                      onChange={handleToggleSelectAll}
                      className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 w-12 text-center">State</th>
                  <th className="py-3 px-4">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>Node / Directory</span>
                      {sortField === 'name' ? (
                        sortAsc ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Git Repository</th>
                  <th className="py-3 px-4">Commit / Branch</th>
                  <th className="py-3 px-4">
                    <button
                      onClick={() => handleSort('health')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>Health</span>
                      {sortField === 'health' ? (
                        sortAsc ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      onClick={() => handleSort('size')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>Size</span>
                      {sortField === 'size' ? (
                        sortAsc ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {sortedNodes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No custom nodes matched your criteria.
                    </td>
                  </tr>
                ) : (
                  sortedNodes.map((node) => {
                    const displayName = showCleanNames
                      ? aliases[node.folderName] || node.cleanDisplayName
                      : node.folderName;
                    const isContextTarget = contextMenu?.nodeId === node.id;

                    return (
                      <tr
                        key={node.id}
                        onContextMenu={(e) => handleOpenContextMenu(e, node)}
                        className={`hover:bg-slate-800/30 transition-colors cursor-context-menu ${
                          !node.enabled ? 'opacity-60 bg-slate-950/20' : ''
                        } ${selectedNodeIds.has(node.id) ? 'bg-indigo-950/20' : ''} ${
                          isContextTarget ? 'bg-indigo-950/35 ring-1 ring-inset ring-indigo-500/60' : ''
                        }`}
                      >
                      {/* Row Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedNodeIds.has(node.id)}
                          onChange={() => handleToggleSelectNode(node.id)}
                          className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* State Toggle */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => onToggleNodeState(node.folderName)}
                          title={node.enabled ? 'Click to disable' : 'Click to enable'}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                            node.enabled ? 'bg-indigo-600' : 'bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              node.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Name & Folder */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            {editingAliasFolder === node.folderName ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={aliasInputValue}
                                  onChange={(e) => setAliasInputValue(e.target.value)}
                                  className="px-2 py-0.5 rounded bg-slate-950 border border-indigo-500 text-xs text-white"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveAlias(node.folderName)}
                                  className="text-emerald-400 hover:text-emerald-300"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <span
                                className="font-semibold text-slate-100 hover:text-indigo-300 cursor-pointer"
                                onClick={() =>
                                  handleStartEditAlias(
                                    node.folderName,
                                    aliases[node.folderName] || node.cleanDisplayName
                                  )
                                }
                                title="Click to rename display alias"
                              >
                                {displayName}
                              </span>
                            )}

                            {node.hasUpdate && (
                              <span className="text-[10px] font-mono text-amber-400">
                                Update
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                            <span>{node.folderName.replace(/\.disabled$/i, '')}{!node.enabled ? '.disabled' : ''}</span>
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              onClick={() => setSearchQuery(node.author)}
                              title={`Filter by author @${node.author}`}
                              className="text-slate-400 hover:text-indigo-300 transition-colors"
                            >
                              @{node.author}
                            </button>
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              onClick={() => setCategoryFilter(categoryFilter === node.category ? 'all' : node.category)}
                              title={`Filter by category ${node.category}`}
                              className="text-indigo-400/90 hover:text-indigo-300 transition-colors"
                            >
                              {node.category}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Git URL */}
                      <td className="py-3.5 px-4 max-w-[200px] truncate">
                        <a
                          href={node.gitUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
                        >
                          <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{node.gitUrl.replace('https://github.com/', '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                        </a>
                      </td>

                      {/* Commit / Branch */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 font-mono">
                          <button
                            onClick={() => handleCopyCommit(node.currentCommit)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                            title="Copy commit hash"
                          >
                            <span>{node.currentCommit.slice(0, 7)}</span>
                            {copiedCommit === node.currentCommit ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-500" />
                            )}
                          </button>
                          <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                            <GitBranch className="w-3 h-3" />
                            <span>{node.branch}</span>
                          </span>
                        </div>
                      </td>

                      {/* Health Badge */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => onNavigateToDoctor(node.id)}
                          className="flex items-center gap-1.5 focus:outline-none"
                        >
                          {node.healthStatus === 'compliant' && (
                            <span className="flex items-center gap-1 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Compliant</span>
                            </span>
                          )}
                          {node.healthStatus === 'fragile' && (
                            <span className="flex items-center gap-1 text-amber-400 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Fragile ({node.healthIssues.length})</span>
                            </span>
                          )}
                          {node.healthStatus === 'os_locked' && (
                            <span className="flex items-center gap-1 text-rose-400 font-medium">
                              <AlertOctagon className="w-3.5 h-3.5" />
                              <span>OS-Locked</span>
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Size & Disk Progress Bar */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-400">
                        <div className="w-28 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-200">{node.sizeMb} MB</span>
                            <span className="text-[10px] text-slate-500">
                              {totalDiskMb > 0 ? Math.round(((node.sizeMb || 0) / totalDiskMb) * 100) : 0}%
                            </span>
                          </div>
                          <div
                            className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden"
                            title={`${node.sizeMb} MB (${totalDiskMb > 0 ? Math.round(((node.sizeMb || 0) / totalDiskMb) * 100) : 0}% of custom_nodes/ disk usage)`}
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300"
                              style={{
                                width: `${Math.max(Math.round(((node.sizeMb || 0) / maxRepoSizeMb) * 100), 4)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={updatingFolder === node.folderName}
                            onClick={async () => {
                              if (onUpdateSingleNode) {
                                setUpdatingFolder(node.folderName);
                                try {
                                  const res = await onUpdateSingleNode(node.folderName);
                                  if (res && 'message' in res && res.message) {
                                    setMassActionMessage(res.message);
                                  }
                                } finally {
                                  setUpdatingFolder(null);
                                }
                              } else {
                                onNavigateToRunner(
                                  `git -C custom_nodes/${node.folderName} pull && pip install -r custom_nodes/${node.folderName}/requirements.txt`
                                );
                              }
                            }}
                            className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded transition-colors"
                            title="Pull latest upstream commit on disk"
                          >
                            {updatingFolder === node.folderName ? 'Updating...' : 'Update'}
                          </button>

                          <button
                            onClick={() => onUninstallNode(node.folderName)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                            title="Safe uninstall (moves to Trash)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Right-Click Floating Context Menu */}
      {contextMenu && contextMenuNode && (() => {
        const githubHref = normalizeGitHubHref(contextMenuNode.gitUrl);
        const displayTitle =
          aliases[contextMenuNode.folderName] || contextMenuNode.cleanDisplayName;

        return (
          <div
            ref={contextMenuRef}
            role="menu"
            aria-label={`Quick actions for ${displayTitle}`}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onContextMenu={(e) => e.preventDefault()}
            className="fixed z-50 w-60 rounded-xl border border-slate-700/90 bg-[#0d121c]/95 backdrop-blur-md shadow-2xl py-1.5 text-xs text-slate-200 animate-fade-in"
          >
            <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
              <div className="font-semibold text-white truncate">{displayTitle}</div>
              <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                {contextMenuNode.folderName.replace(/\.disabled$/i, '')}
                {!contextMenuNode.enabled ? '.disabled' : ''}
              </div>
            </div>

            {githubHref ? (
              <a
                role="menuitem"
                href={githubHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => setContextMenu(null)}
                className="flex items-center justify-between gap-2.5 w-full px-3 py-2 text-left text-slate-200 hover:bg-indigo-600/20 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Open in GitHub</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">repo</span>
              </a>
            ) : (
              <div
                role="menuitem"
                aria-disabled="true"
                className="flex items-center gap-2.5 w-full px-3 py-2 text-slate-500 cursor-not-allowed"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>Open in GitHub (No URL)</span>
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => handleViewReadme(contextMenuNode)}
              className="flex items-center justify-between gap-2.5 w-full px-3 py-2 text-left text-slate-200 hover:bg-indigo-600/20 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>View Readme</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">.md</span>
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={reinstallingFolder === contextMenuNode.folderName}
              onClick={() => handleForceReinstall(contextMenuNode)}
              className="flex items-center justify-between gap-2.5 w-full px-3 py-2 text-left text-slate-200 hover:bg-indigo-600/20 hover:text-white transition-colors disabled:opacity-50"
            >
              <span className="flex items-center gap-2.5">
                <RefreshCw
                  className={`w-3.5 h-3.5 text-amber-400 shrink-0 ${
                    reinstallingFolder === contextMenuNode.folderName ? 'animate-spin' : ''
                  }`}
                />
                <span>Force Reinstall</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">git+pip</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleNodeState(contextMenuNode.folderName);
                setContextMenu(null);
              }}
              className="flex items-center justify-between gap-2.5 w-full px-3 py-2 text-left text-slate-200 hover:bg-indigo-600/20 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                {contextMenuNode.enabled ? (
                  <EyeOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span>Toggle Visibility</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {contextMenuNode.enabled ? 'hide' : 'show'}
              </span>
            </button>

            <div className="my-1.5 border-t border-slate-800/80" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDrawerNodeId(contextMenuNode.id);
                setContextMenu(null);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
            >
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Inspect Node Details</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onUninstallNode(contextMenuNode.folderName);
                setContextMenu(null);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Move to Trash</span>
            </button>
          </div>
        );
      })()}

      {/* README Viewer Modal */}
      {readmeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                  <h3 className="text-sm font-semibold text-white truncate">
                    {aliases[readmeModal.node.folderName] || readmeModal.node.cleanDisplayName} · {readmeModal.fileName}
                  </h3>
                </div>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                  {readmeModal.source}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!readmeModal.loading && readmeModal.content && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(readmeModal.content);
                      setCopiedReadme(true);
                      setTimeout(() => setCopiedReadme(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
                  >
                    {copiedReadme ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedReadme ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
                {normalizeGitHubHref(readmeModal.node.gitUrl) && (
                  <a
                    href={normalizeGitHubHref(readmeModal.node.gitUrl) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs text-indigo-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setReadmeModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-950/70">
              {readmeModal.loading ? (
                <div className="py-12 text-center text-xs font-mono text-slate-400">
                  Loading README documentation...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-300 leading-relaxed">
                  {readmeModal.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Folder Normalizer Modal */}
      {showNormalizerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-semibold text-white">
                  Folder Normalizer (Phase 5)
                </h3>
              </div>
              <button
                onClick={() => setShowNormalizerModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              Detects non-standard directory naming (e.g. trailing <code>_plus</code>, mixed casing, missing <code>ComfyUI-</code> prefix) and standardizes them via safe atomic filesystem directory rename.
            </p>

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium">
                    <th className="py-2 px-3">Current Folder</th>
                    <th className="py-2 px-3">Proposed Standard Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {normalizerCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-6 text-center text-slate-500">
                        All installed folders comply with standard conventions!
                      </td>
                    </tr>
                  ) : (
                    normalizerCandidates.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 px-3 text-rose-300">{c.folderName}</td>
                        <td className="py-2.5 px-3 text-emerald-300">
                          {c.normalizedProposedName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 mt-5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowNormalizerModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              {normalizerCandidates.length > 0 && (
                <button
                  onClick={() => {
                    const batch = normalizerCandidates.map((c) => ({
                      original: c.folderName,
                      proposed: c.normalizedProposedName!,
                    }));
                    onNormalizeBatch(batch);
                    setShowNormalizerModal(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
                >
                  Apply Normalization ({normalizerCandidates.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trash Bin Modal */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-slate-400" />
                <h3 className="text-base font-semibold text-white">
                  Safe Trash Bin ({trashNodes.length})
                </h3>
              </div>
              <button
                onClick={() => setShowTrashModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              Deleted custom nodes are quarantined safely here rather than permanently purged. You can restore them back to <code>custom_nodes/</code> at any time.
            </p>

            <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              {trashNodes.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Trash bin is empty.
                </div>
              ) : (
                trashNodes.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/60"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        {t.folderName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {t.gitUrl}
                      </div>
                    </div>
                    <button
                      onClick={() => onRestoreNode(t.folderName)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => setShowTrashModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slideover Node Details Drawer */}
      {drawerNode && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#070a10] border-l border-slate-800 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {aliases[drawerNode.folderName] || drawerNode.cleanDisplayName}
                    </h3>
                    <div className="text-[11px] font-mono text-slate-500">
                      {drawerNode.folderName}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerNodeId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Status Badges */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">State</div>
                  <div className="mt-1 font-semibold flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${drawerNode.enabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500'}`} />
                    <span className={drawerNode.enabled ? 'text-emerald-300' : 'text-slate-400'}>
                      {drawerNode.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Health Status</div>
                  <div className="mt-1 font-semibold">
                    {drawerNode.healthStatus === 'compliant' && <span className="text-emerald-400">🟢 Compliant</span>}
                    {drawerNode.healthStatus === 'fragile' && <span className="text-amber-400">🟡 Fragile</span>}
                    {drawerNode.healthStatus === 'os_locked' && <span className="text-rose-400">🔴 OS-Locked</span>}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">Description</span>
                <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  {drawerNode.description || 'No description provided.'}
                </p>
              </div>

              {/* Provided Node Classes */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                    Node Classes ({drawerNode.providesNodes.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                  {drawerNode.providesNodes.map((cls, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-900/40 text-indigo-300 font-mono text-[11px]"
                    >
                      {cls}
                    </span>
                  ))}
                </div>
              </div>

              {/* Git & Storage Metadata */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Repository:</span>
                  <a
                    href={drawerNode.gitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 truncate max-w-[220px]"
                  >
                    <span>{drawerNode.gitUrl.replace('https://github.com/', '')}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Commit:</span>
                  <span className="text-slate-300">{drawerNode.currentCommit.slice(0, 7)} ({drawerNode.branch || 'main'})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Disk Footprint:</span>
                  <span className="text-slate-300">{drawerNode.sizeMb.toFixed(1)} MB ({drawerNode.filesCount} files)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Category / Author:</span>
                  <span className="text-slate-300">{drawerNode.category} / @{drawerNode.author}</span>
                </div>
              </div>
            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-6 border-t border-slate-800 flex items-center gap-3">
              <button
                onClick={() => {
                  onToggleNodeState(drawerNode.folderName);
                  setDrawerNodeId(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  drawerNode.enabled
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {drawerNode.enabled ? 'Disable Node' : 'Enable Node'}
              </button>

              <button
                onClick={() => {
                  onNavigateToDoctor(drawerNode.id);
                  setDrawerNodeId(null);
                }}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Health Check
              </button>

              <button
                onClick={() => {
                  onUninstallNode(drawerNode.folderName);
                  setDrawerNodeId(null);
                }}
                className="p-2 text-xs font-semibold rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-400 hover:bg-rose-900/60 transition-colors"
                title="Quarantine to Trash"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Multi-Select Batch Actions Bar */}
      {selectedNodeIds.size > 0 && (
        <div className="fixed bottom-11 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-indigo-500/50 shadow-2xl backdrop-blur-md text-xs font-mono animate-fade-in">
          <span className="text-white font-semibold tabular-nums">{selectedNodeIds.size} nodes selected</span>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={() => handleBatchToggleState(true)}
            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-medium transition-colors"
          >
            Enable All
          </button>
          <button
            onClick={() => handleBatchToggleState(false)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans font-medium transition-colors"
          >
            Disable All
          </button>
          <button
            onClick={() => setSelectedNodeIds(new Set())}
            className="text-slate-400 hover:text-slate-200 text-[11px] underline ml-1 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
