'use client';

import React, { useState } from 'react';
import {
  Layers,
  Search,
  Check,
  Copy,
  ExternalLink,
  Trash2,
  RotateCcw,
  Sparkles,
  GitBranch,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Eye,
  Wand2,
  FolderSync,
  HardDrive,
  BarChart3,
  PieChart,
  X,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
} from 'lucide-react';
import { InstalledNode, HealthStatus } from '@/types';

interface InspectorViewProps {
  nodes: InstalledNode[];
  trashNodes: InstalledNode[];
  showCleanNames: boolean;
  setShowCleanNames: (show: boolean) => void;
  aliases: Record<string, string>;
  onUpdateAlias: (folderName: string, alias: string) => void;
  onToggleNodeState: (folderName: string) => void;
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
  onUninstallNode,
  onRestoreNode,
  onNormalizeBatch,
  onNavigateToDoctor,
  onNavigateToRunner,
}: InspectorViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled' | 'updates'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedCommit, setCopiedCommit] = useState<string | null>(null);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showNormalizerModal, setShowNormalizerModal] = useState(false);
  const [editingAliasFolder, setEditingAliasFolder] = useState<string | null>(null);
  const [aliasInputValue, setAliasInputValue] = useState('');
  const [repoLimit, setRepoLimit] = useState<number>(5);
  const [pieMetric, setPieMetric] = useState<'count' | 'size'>('count');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'size' | 'health'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);

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
      .sort((a, b) => b.totalMb - a.totalMb);
  }, [nodes, totalDiskMb]);

  // Generate SVG Pie Slices for Category Breakdown with Metric Toggle
  const pieSlices = React.useMemo(() => {
    const total = pieMetric === 'count' ? nodes.length : totalDiskMb;
    if (total === 0) return [];

    let currentAngle = -Math.PI / 2; // start from 12 o'clock (top)
    const cx = 50;
    const cy = 50;
    const radius = 42;

    return categoryStats.map((item) => {
      const val = pieMetric === 'count' ? item.count : item.totalMb;
      const sliceAngle = total > 0 ? (val / total) * 2 * Math.PI : 0;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);

      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
      const isFull = sliceAngle >= 2 * Math.PI - 0.001;

      const pathData = isFull
        ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius} Z`
        : `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;

      const slicePercentage = total > 0 ? Math.round((val / total) * 100) : 0;

      return {
        ...item,
        pathData,
        slicePercentage,
      };
    });
  }, [categoryStats, nodes.length, totalDiskMb, pieMetric]);

  const hoveredCategoryData = React.useMemo(() => {
    if (!hoveredCategory) return null;
    return categoryStats.find((c) => c.category === hoveredCategory) || null;
  }, [categoryStats, hoveredCategory]);

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

  const handleBatchToggleState = (targetEnabled: boolean) => {
    for (const node of nodes) {
      if (selectedNodeIds.has(node.id) && node.enabled !== targetEnabled) {
        onToggleNodeState(node.folderName);
      }
    }
  };

  const drawerNode = nodes.find((n) => n.id === drawerNodeId) || null;

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

            {/* Folder Normalizer Button */}
            <button
              onClick={() => setShowNormalizerModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Normalizer Tool ({normalizerCandidates.length})</span>
            </button>

            {/* Safe Trash Bin */}
            <button
              onClick={() => setShowTrashModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Trash Bin ({trashNodes.length})</span>
            </button>
          </div>
        </div>

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

        {/* Mini Charts Visualization Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-800/80">
          {/* Mini Chart 1: Category Distribution Pie Chart */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
                <div className="flex items-center gap-2">
                  <PieChart className="w-3.5 h-3.5 text-indigo-400" />
                  <h3 className="text-xs font-semibold text-slate-200">
                    Category Composition Pie Chart
                  </h3>
                </div>

                {/* Metric Mode Toggle: Count vs Disk Size */}
                <div className="flex items-center gap-1 text-[11px]">
                  <button
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

              <p className="text-[11px] text-slate-400 mt-2 mb-3">
                Distribution of custom nodes by category ({pieMetric === 'count' ? 'node count' : 'disk footprint'}). Click any slice to filter the inventory below.
              </p>

              {/* Mini Pie Chart + Legend Layout */}
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mt-1">
                {/* SVG Vector Mini Pie Chart */}
                <div className="relative shrink-0 flex items-center justify-center p-1">
                  <svg
                    width="118"
                    height="118"
                    viewBox="0 0 100 100"
                    className="overflow-visible select-none drop-shadow-sm"
                  >
                    {pieSlices.map((slice) => {
                      const isSelected = categoryFilter === slice.category;
                      const isHovered = hoveredCategory === slice.category;

                      return (
                        <path
                          key={slice.category}
                          d={slice.pathData}
                          fill={slice.color}
                          stroke="#070a0f"
                          strokeWidth="1.5"
                          onMouseEnter={() => setHoveredCategory(slice.category)}
                          onMouseLeave={() => setHoveredCategory(null)}
                          onClick={() =>
                            setCategoryFilter(isSelected ? 'all' : slice.category)
                          }
                          className="cursor-pointer transition-all duration-200 hover:opacity-90 focus:outline-none"
                          style={{
                            transformOrigin: '50px 50px',
                            transform: isSelected ? 'scale(1.08)' : isHovered ? 'scale(1.05)' : 'scale(1)',
                            filter: isSelected || isHovered ? 'drop-shadow(0 0 6px rgba(255,255,255,0.45))' : 'none',
                          }}
                        >
                          <title>{`${slice.category}: ${slice.count} nodes (${slice.percentage}%), ${slice.totalMb} MB`}</title>
                        </path>
                      );
                    })}

                    {/* Donut Core */}
                    <circle cx="50" cy="50" r="22" fill="#070a0f" stroke="#1e293b" strokeWidth="1" />
                    {hoveredCategoryData ? (
                      <>
                        <text
                          x="50"
                          y="43"
                          textAnchor="middle"
                          className="text-[10px] font-mono font-bold fill-indigo-300 tabular-nums"
                        >
                          {pieMetric === 'count' ? `${hoveredCategoryData.percentage}%` : `${hoveredCategoryData.sizePercentage}%`}
                        </text>
                        <text
                          x="50"
                          y="53"
                          textAnchor="middle"
                          className="text-[6.5px] font-sans font-medium fill-slate-200 truncate"
                        >
                          {hoveredCategoryData.category.slice(0, 10)}
                        </text>
                        <text
                          x="50"
                          y="62"
                          textAnchor="middle"
                          className="text-[6px] font-mono fill-slate-400"
                        >
                          {pieMetric === 'count' ? `${hoveredCategoryData.count} node` : `${hoveredCategoryData.totalMb}MB`}
                        </text>
                      </>
                    ) : (
                      <>
                        <text
                          x="50"
                          y="47"
                          textAnchor="middle"
                          className="text-[11px] font-mono font-bold fill-slate-100 tabular-nums"
                        >
                          {pieMetric === 'count' ? nodes.length : `${totalDiskMb}M`}
                        </text>
                        <text
                          x="50"
                          y="58"
                          textAnchor="middle"
                          className="text-[7.5px] font-mono fill-slate-400 tracking-wider"
                        >
                          {pieMetric === 'count' ? 'NODES' : 'STORAGE'}
                        </text>
                      </>
                    )}
                  </svg>
                </div>

                {/* Category Legend & Breakdown List */}
                <div className="grid grid-cols-2 gap-2 flex-1 w-full">
                  {categoryStats.map((cat) => {
                    const isSelected = categoryFilter === cat.category;
                    const isHovered = hoveredCategory === cat.category;

                    return (
                      <button
                        key={cat.category}
                        onMouseEnter={() => setHoveredCategory(cat.category)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={() =>
                          setCategoryFilter(isSelected ? 'all' : cat.category)
                        }
                        className={`flex items-start gap-2 p-1.5 rounded text-left transition-colors ${
                          isSelected
                            ? 'bg-slate-800/90 border border-slate-700'
                            : isHovered
                            ? 'bg-slate-900 border border-slate-700/60'
                            : 'hover:bg-slate-900/80 border border-transparent'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0 mt-1"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium text-slate-200 truncate">
                            {cat.category}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                            {pieMetric === 'count'
                              ? `${cat.count} nodes · ${cat.percentage}%`
                              : `${cat.totalMb} MB · ${cat.sizePercentage}%`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stacked Proportional Bar Indicator Below Pie */}
              <div className="mt-4 pt-3 border-t border-slate-800/60">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                  <span>Proportional Footprint</span>
                  <span>{totalDiskMb} MB total</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                  {categoryStats.map((cat) => (
                    <button
                      key={cat.category}
                      onMouseEnter={() => setHoveredCategory(cat.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() =>
                        setCategoryFilter(categoryFilter === cat.category ? 'all' : cat.category)
                      }
                      title={`${cat.category}: ${cat.count} nodes (${cat.percentage}%), ${cat.totalMb} MB`}
                      style={{
                        width: `${Math.max(cat.sizePercentage, 3)}%`,
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

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              Showing <strong className="text-slate-200">{filteredNodes.length}</strong> of {nodes.length} nodes
            </span>

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

      {/* Nodes Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
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

                  return (
                    <tr
                      key={node.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        !node.enabled ? 'opacity-60 bg-slate-950/20' : ''
                      } ${selectedNodeIds.has(node.id) ? 'bg-indigo-950/20' : ''}`}
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
                            <span>{node.folderName}{!node.enabled ? '.disabled' : ''}</span>
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

                      {/* Size & Files */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-400">
                        {node.sizeMb} MB
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              onNavigateToRunner(
                                `git -C custom_nodes/${node.folderName} pull && pip install -r requirements.txt`
                              )
                            }
                            className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                            title="Pull latest commit & run pip safely"
                          >
                            Update
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
              Detects non-standard directory naming (e.g. trailing <code>_plus</code>, mixed casing, missing <code>ComfyUI-</code> prefix) and standardizes them using safe atomic <code>std::fs::rename</code>.
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
