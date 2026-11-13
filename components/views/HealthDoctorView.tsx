'use client';

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wand2,
  FileCode,
  Check,
  RotateCcw,
  Layers,
  ShieldAlert,
  ArrowRight,
  PackageCheck,
  Camera,
} from 'lucide-react';
import { InstalledNode, RegistryNode } from '@/types';
import {
  lintPythonNodeCode,
  autoPatchPythonCode,
  LintAnalysisResult,
} from '@/lib/health-linter';
import {
  detectDependencyConflicts,
} from '@/lib/conflict-detector';
import { diffPipSnapshots, PipSnapshot } from '@/lib/pip-snapshot';
import { COMMUNITY_REGISTRY } from '@/lib/default-data';
import { readNodeFileReal, patchNodeFileReal } from '@/lib/system-client';

interface HealthDoctorViewProps {
  installedNodes: InstalledNode[];
  comfyRoot: string;
  pythonBinary?: string;
  scannedRequirementsMap?: Record<string, string[]>;
  onPatchInstalledNode?: (nodeId: string) => void;
}

const PIP_BASELINE_STORAGE_KEY = 'sentinel_pip_baseline';
const PIP_LATEST_STORAGE_KEY = 'sentinel_pip_latest';

function loadStoredSnapshot(key: string): PipSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PipSnapshot) : null;
  } catch {
    return null;
  }
}

export function HealthDoctorView({
  installedNodes,
  comfyRoot,
  pythonBinary = 'python',
  scannedRequirementsMap,
  onPatchInstalledNode,
}: HealthDoctorViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'linter' | 'conflict_matrix' | 'pip_drift'>('linter');
  const [pipBaseline, setPipBaseline] = useState<PipSnapshot | null>(() => loadStoredSnapshot(PIP_BASELINE_STORAGE_KEY));
  const [pipLatest, setPipLatest] = useState<PipSnapshot | null>(() => loadStoredSnapshot(PIP_LATEST_STORAGE_KEY));
  const [isCapturingPip, setIsCapturingPip] = useState(false);
  const [pipError, setPipError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    () => installedNodes.find((n) => n.healthStatus !== 'compliant')?.id || installedNodes[0]?.id || ''
  );
  const [activeRelativeFile, setActiveRelativeFile] = useState<string>('__init__.py');
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [customPythonCode, setCustomPythonCode] = useState<string>('');
  const [patchedToast, setPatchedToast] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');

  // Analyze active code (memoized so typing/filtering doesn't re-lint unnecessarily)
  const lintResult: LintAnalysisResult = useMemo(
    () =>
      lintPythonNodeCode(
        customPythonCode,
        activeRelativeFile || (selectedNodeId ? `${selectedNodeId}.py` : 'node.py')
      ),
    [customPythonCode, selectedNodeId, activeRelativeFile]
  );

  // Requirements map constructed from real scanned requirements.txt files (or registry fallback)
  const requirementsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const node of installedNodes) {
      const scanned = scannedRequirementsMap?.[node.folderName];
      if (scanned && scanned.length > 0) {
        map[node.folderName] = scanned;
      } else {
        const reg = COMMUNITY_REGISTRY.find(
          (r: RegistryNode) => r.name.toLowerCase() === node.folderName.toLowerCase() || r.id === node.id
        );
        if (reg && reg.requirements && reg.requirements.length > 0) {
          map[node.folderName] = reg.requirements;
        }
      }
    }
    return map;
  }, [installedNodes, scannedRequirementsMap]);

  // Run conflict detection
  const detectedConflicts = useMemo(() => {
    return detectDependencyConflicts(requirementsMap);
  }, [requirementsMap]);

  const filteredConflicts = useMemo(() => {
    if (severityFilter === 'all') return detectedConflicts;
    return detectedConflicts.filter((c) => c.severity === severityFilter);
  }, [detectedConflicts, severityFilter]);

  const criticalCount = detectedConflicts.filter((c) => c.severity === 'critical').length;
  const warningCount = detectedConflicts.filter((c) => c.severity === 'warning').length;

  const handleSelectNode = async (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setFileLoadError(null);
    if (!nodeId) {
      setCustomPythonCode('');
      return;
    }

    const node = installedNodes.find((n) => n.id === nodeId);
    if (!node) return;

    const targetFile = node.healthIssues[0]?.file || '__init__.py';
    setActiveRelativeFile(targetFile);
    setIsLoadingFile(true);
    try {
      const res = await readNodeFileReal(comfyRoot, node.folderName, targetFile);
      if (res.success && typeof res.content === 'string') {
        setCustomPythonCode(res.content);
      } else {
        setFileLoadError(res.error || `Could not read ${targetFile}`);
        setCustomPythonCode(`# Unable to load ${node.folderName}/${targetFile}\n# ${res.error || 'File not found'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read file';
      setFileLoadError(msg);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleAutoPatch = async () => {
    const { patchedCode } = autoPatchPythonCode(customPythonCode);
    setCustomPythonCode(patchedCode);

    if (selectedNodeId) {
      const node = installedNodes.find((n) => n.id === selectedNodeId);
      if (node) {
        const res = await patchNodeFileReal(comfyRoot, node.folderName, activeRelativeFile, patchedCode);
        if (!res.success) {
          setFileLoadError(res.error || 'Failed to write patched file to disk');
          return;
        }
      }
    }

    setPatchedToast(true);
    setTimeout(() => setPatchedToast(false), 2500);

    if (onPatchInstalledNode && selectedNodeId) {
      onPatchInstalledNode(selectedNodeId);
    }
  };

  const handleReloadFile = () => {
    if (selectedNodeId) {
      void handleSelectNode(selectedNodeId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Static Analysis Linter & Conflict Matrix</span>
              <span aria-hidden="true">·</span>
              <span>The &ldquo;Health Doctor&rdquo; (Phase 5 &amp; 8)</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Custom Node Health Doctor &amp; Conflict Matrix
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Inspect Python AST anti-patterns, auto-patch non-portable paths, and detect cross-node package collisions (e.g. <code>opencv-python</code> vs <code>opencv-python-headless</code>, <code>numpy&lt;2</code> vs <code>numpy&gt;=2</code>).
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeSubTab === 'linter' && (
              <button
                onClick={handleAutoPatch}
                disabled={lintResult.fixCount === 0 || isLoadingFile}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors ${
                  lintResult.fixCount > 0 && !isLoadingFile
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Auto-Patch Code ({lintResult.fixCount} Fixes)</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveSubTab('linter')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'linter'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Python AST &amp; Path Linter</span>
          </button>

          <button
            onClick={() => setActiveSubTab('conflict_matrix')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'conflict_matrix'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dependency Conflict Matrix</span>
            {detectedConflicts.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                criticalCount > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950'
              }`}>
                {detectedConflicts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('pip_drift')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'pip_drift'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Pip Snapshot &amp; Drift</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: AST LINTER */}
      {activeSubTab === 'linter' && (
        <>
          {/* Health Status Badges Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-semibold text-emerald-300">🟢 Compliant</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Relative imports &amp; os.path safe
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-950/20 border border-amber-900/40">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="font-semibold text-amber-300">🟡 Fragile</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Hardcoded folder name or \\ path
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-950/20 border border-rose-900/40">
              <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <div className="font-semibold text-rose-300">🔴 OS-Locked</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Hardcoded C:\Users\ drive paths
                </div>
              </div>
            </div>
          </div>

          {/* Main Doctor Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Node Selector & Flagged Issues (1 col) */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Select Target Node to Inspect
                </label>
                <select
                  value={selectedNodeId}
                  onChange={(e) => handleSelectNode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="">
                    {installedNodes.length > 0
                      ? 'Select an installed custom node...'
                      : 'No custom nodes scanned yet'}
                  </option>
                  {installedNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.folderName} [{n.healthStatus.toUpperCase()}]
                    </option>
                  ))}
                </select>
                {fileLoadError && (
                  <p className="mt-2 text-[11px] text-rose-400 font-mono">{fileLoadError}</p>
                )}
              </div>

              {/* Issue Breakdown */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">
                    Detected Health Violations ({lintResult.issues.length})
                  </h3>
                  <div className="text-xs font-mono">
                    {lintResult.status === 'compliant' && (
                      <span className="text-emerald-400 font-semibold">100% HEALTHY</span>
                    )}
                    {lintResult.status === 'fragile' && (
                      <span className="text-amber-400 font-semibold">FRAGILE</span>
                    )}
                    {lintResult.status === 'os_locked' && (
                      <span className="text-rose-400 font-semibold">OS-LOCKED</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {lintResult.issues.length === 0 ? (
                    <div className="p-6 text-center text-xs text-emerald-400 font-mono">
                      ✓ Zero lint issues found. Code is clean and portable.
                    </div>
                  ) : (
                    lintResult.issues.map((iss) => (
                      <div
                        key={iss.id}
                        className="p-3 rounded-lg border border-slate-800 bg-slate-950 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">
                            {iss.title}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            Line {iss.line}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {iss.description}
                        </p>

                        <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-rose-300 break-all">
                          {iss.snippet}
                        </div>

                        {iss.suggestedPatch && (
                          <div className="text-[11px] text-emerald-400 font-mono">
                            Fix: <code>{iss.suggestedPatch}</code>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Python Code Editor / Viewer (2 cols) */}
            <div className="lg:col-span-2 flex flex-col rounded-xl border border-slate-800 bg-slate-950 shadow-lg overflow-hidden h-[600px]">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-mono text-slate-300">
                    {selectedNodeId ? `${activeRelativeFile || `${selectedNodeId}.py`}` : 'Select a custom node or paste Python code'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {patchedToast && (
                    <span className="text-xs text-emerald-400 font-mono flex items-center gap-1 animate-fade-in">
                      <Check className="w-3.5 h-3.5" />
                      <span>Patched Successfully!</span>
                    </span>
                  )}
                  {selectedNodeId && (
                    <button
                      onClick={handleReloadFile}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reload File</span>
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={customPythonCode}
                onChange={(e) => setCustomPythonCode(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full p-4 font-mono text-xs text-slate-200 bg-slate-950 resize-none focus:outline-none leading-relaxed select-all"
              />

              <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
                <span>Lines analyzed: {lintResult.linesAnalyzed}</span>
                <span>
                  Status:{' '}
                  <strong className={lintResult.issues.length ? 'text-amber-400' : 'text-emerald-400'}>
                    {lintResult.issues.length} flagged lines
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEW 2: DEPENDENCY CONFLICT MATRIX */}
      {activeSubTab === 'conflict_matrix' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="text-slate-400 text-[11px]">Total Analyzed Nodes</div>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {Object.keys(requirementsMap).length}
              </div>
              <div className="text-slate-500 text-[11px] mt-1 font-sans">
                Active custom nodes inspected
              </div>
            </div>

            <div className="p-4 rounded-xl border border-rose-900/40 bg-rose-950/20">
              <div className="text-rose-400 text-[11px] font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Critical Clashes</span>
              </div>
              <div className="text-2xl font-bold text-rose-300 mt-1 tabular-nums">
                {criticalCount}
              </div>
              <div className="text-slate-400 text-[11px] mt-1 font-sans">
                Symbol / ABI incompatibility
              </div>
            </div>

            <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/20">
              <div className="text-amber-400 text-[11px] font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Version Warnings</span>
              </div>
              <div className="text-2xl font-bold text-amber-300 mt-1 tabular-nums">
                {warningCount}
              </div>
              <div className="text-slate-400 text-[11px] mt-1 font-sans">
                Conflicting exact version pins
              </div>
            </div>
          </div>

          {/* Conflict List Container */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Identified Package Collisions ({filteredConflicts.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Simultaneous installations that break Python runtime or CUDA GPU acceleration.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                {(['all', 'critical', 'warning'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      severityFilter === sev
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {sev === 'all' ? 'All' : sev === 'critical' ? 'Critical' : 'Warnings'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {filteredConflicts.length === 0 ? (
                <div className="p-10 text-center text-xs text-emerald-400 font-mono space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <div className="font-semibold text-sm">Zero Dependency Collisions Detected</div>
                  <div className="text-slate-400 font-sans text-xs max-w-md mx-auto">
                    All installed custom nodes have compatible package bounds and can be installed concurrently without pip resolution failures.
                  </div>
                </div>
              ) : (
                filteredConflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className={`p-4 rounded-xl border text-xs space-y-3 ${
                      conflict.severity === 'critical'
                        ? 'bg-slate-950/80 border-rose-900/60'
                        : 'bg-slate-950/80 border-amber-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            conflict.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {conflict.severity}
                        </span>
                        <span className="font-mono font-bold text-white text-sm">
                          {conflict.packageName}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {conflict.description}
                    </p>

                    {/* Nodes Involved Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                      {conflict.nodesInvolved.map((node, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-slate-200">
                            {node.folderName}
                          </span>
                          <span className="font-mono text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/40 text-[11px]">
                            {node.requirement}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Actionable Resolution */}
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start gap-2.5 text-xs text-emerald-300">
                      <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Recommended Resolution: </strong>
                        {conflict.recommendedResolution}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: PYTHON PIP SNAPSHOT & DRIFT DIFF */}
      {activeSubTab === 'pip_drift' && (() => {
        const handleCapture = async (asBaseline: boolean) => {
          setIsCapturingPip(true);
          setPipError(null);
          try {
            const res = await fetch('/api/env/pip-snapshot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pythonBinary }),
            });
            const data = await res.json();
            if (!res.ok) {
              setPipError(data.error || 'Failed to capture pip snapshot');
              return;
            }
            const snap: PipSnapshot = {
              capturedAt: data.capturedAt,
              pythonBinary: data.pythonBinary,
              packages: data.packages,
            };
            if (asBaseline || !pipBaseline) {
              setPipBaseline(snap);
              window.localStorage.setItem(PIP_BASELINE_STORAGE_KEY, JSON.stringify(snap));
            }
            setPipLatest(snap);
            window.localStorage.setItem(PIP_LATEST_STORAGE_KEY, JSON.stringify(snap));
          } catch (err) {
            setPipError(err instanceof Error ? err.message : 'Failed to capture pip snapshot');
          } finally {
            setIsCapturingPip(false);
          }
        };

        const drift =
          pipBaseline && pipLatest
            ? diffPipSnapshots(pipBaseline.packages, pipLatest.packages)
            : null;

        return (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Python Environment Snapshot &amp; Drift Diff
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Target runtime: <code className="font-mono text-slate-300">{pythonBinary}</code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleCapture(true)}
                  disabled={isCapturingPip}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isCapturingPip ? 'Capturing…' : 'Set Baseline'}</span>
                </button>
                <button
                  onClick={() => void handleCapture(false)}
                  disabled={isCapturingPip}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>{isCapturingPip ? 'Scanning…' : 'Compare Current'}</span>
                </button>
              </div>
            </div>

            {pipError && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 font-mono">
                {pipError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <div className="text-slate-400 font-medium">Baseline Snapshot</div>
                <div className="font-mono text-slate-200 mt-1">
                  {pipBaseline
                    ? `${Object.keys(pipBaseline.packages).length} packages · ${new Date(pipBaseline.capturedAt).toLocaleString()}`
                    : 'Not captured yet'}
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <div className="text-slate-400 font-medium">Latest Snapshot</div>
                <div className="font-mono text-slate-200 mt-1">
                  {pipLatest
                    ? `${Object.keys(pipLatest.packages).length} packages · ${new Date(pipLatest.capturedAt).toLocaleString()}`
                    : 'Not captured yet'}
                </div>
              </div>
            </div>

            {drift && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Detected Package Drift ({drift.totalChanges} change{drift.totalChanges === 1 ? '' : 's'})
                  </span>
                  <span className="font-mono text-slate-400">
                    +{drift.added.length} added · ~{drift.changed.length} changed · -{drift.removed.length} removed
                  </span>
                </div>

                {drift.totalChanges === 0 ? (
                  <div className="p-6 text-center rounded-lg bg-emerald-950/15 border border-emerald-900/30 text-xs text-emerald-300">
                    No package drift detected since baseline.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden text-xs font-mono">
                    {drift.changed.map((c) => (
                      <div key={`chg-${c.name}`} className="px-3.5 py-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">~</span>
                          <span className="text-slate-200">{c.name}</span>
                          {c.isCritical && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-sans font-semibold">
                              CRITICAL
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400">
                          {c.from} <span className="text-amber-400">→</span> <span className="text-slate-100">{c.to}</span>
                        </span>
                      </div>
                    ))}
                    {drift.added.map((a) => (
                      <div key={`add-${a.name}`} className="px-3.5 py-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">+</span>
                          <span className="text-slate-200">{a.name}</span>
                          {a.isCritical && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-sans font-semibold">
                              CRITICAL
                            </span>
                          )}
                        </div>
                        <span className="text-emerald-300">{a.version}</span>
                      </div>
                    ))}
                    {drift.removed.map((r) => (
                      <div key={`rem-${r.name}`} className="px-3.5 py-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-rose-400 font-bold">-</span>
                          <span className="text-slate-200">{r.name}</span>
                          {r.isCritical && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-sans font-semibold">
                              CRITICAL
                            </span>
                          )}
                        </div>
                        <span className="text-rose-300">{r.version}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
