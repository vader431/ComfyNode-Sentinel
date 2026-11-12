'use client';

import React, { useState } from 'react';
import {
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wand2,
  FileCode,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { InstalledNode } from '@/types';
import {
  lintPythonNodeCode,
  autoPatchPythonCode,
  LintAnalysisResult,
} from '@/lib/health-linter';
import { SAMPLE_PYTHON_CODE_WITH_ISSUES } from '@/lib/default-data';

interface HealthDoctorViewProps {
  installedNodes: InstalledNode[];
  onPatchInstalledNode?: (nodeId: string) => void;
}

export function HealthDoctorView({
  installedNodes,
  onPatchInstalledNode,
}: HealthDoctorViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('sample-sandbox');
  const [customPythonCode, setCustomPythonCode] = useState(
    SAMPLE_PYTHON_CODE_WITH_ISSUES
  );
  const [patchedToast, setPatchedToast] = useState(false);

  // Analyze active code
  const lintResult: LintAnalysisResult = lintPythonNodeCode(
    customPythonCode,
    selectedNodeId === 'sample-sandbox' ? 'node_entry.py' : `${selectedNodeId}.py`
  );

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    if (nodeId === 'sample-sandbox') {
      setCustomPythonCode(SAMPLE_PYTHON_CODE_WITH_ISSUES);
    } else {
      const node = installedNodes.find((n) => n.id === nodeId);
      if (node && node.healthIssues.length > 0) {
        // Construct realistic code containing their recorded issues
        const issueLines = node.healthIssues
          .map((iss) => `# Line ${iss.line}: ${iss.title}\n${iss.snippet}`)
          .join('\n\n');
        setCustomPythonCode(
          `# Inspection of ${node.folderName}\nimport os\n\n${issueLines}\n\n# Node class definitions...\nclass Node:\n    pass\n`
        );
      } else {
        setCustomPythonCode(
          `# ${node?.folderName || 'Clean Node'}\nimport os\nfrom .utils import helper\n\nclass CleanNode:\n    CATEGORY = "Clean"\n    # All paths and imports compliant\n`
        );
      }
    }
  };

  const handleAutoPatch = () => {
    const { patchedCode, changesCount } = autoPatchPythonCode(customPythonCode);
    setCustomPythonCode(patchedCode);
    setPatchedToast(true);
    setTimeout(() => setPatchedToast(false), 2500);

    if (onPatchInstalledNode && selectedNodeId !== 'sample-sandbox') {
      onPatchInstalledNode(selectedNodeId);
    }
  };

  const handleResetSample = () => {
    setCustomPythonCode(SAMPLE_PYTHON_CODE_WITH_ISSUES);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Static Analysis Linter</span>
              <span aria-hidden="true">·</span>
              <span>The &ldquo;Health Doctor&rdquo; (Phase 5)</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Custom Node Health Doctor & Auto-Patcher
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Detects anti-patterns that break ComfyUI across machines: hardcoded <code>custom_nodes</code> self-imports, OS-locked backslash paths, and absolute host directories.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoPatch}
              disabled={lintResult.fixCount === 0}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors ${
                lintResult.fixCount > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto-Patch Code ({lintResult.fixCount} Fixes)</span>
            </button>
          </div>
        </div>

        {/* Health Status Badges Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold text-emerald-300">🟢 Compliant</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Relative imports & os.path safe
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
              <option value="sample-sandbox">
                Interactive Test Sandbox (DWPose Example)
              </option>
              {installedNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.folderName} [{n.healthStatus.toUpperCase()}]
                </option>
              ))}
            </select>
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
                {selectedNodeId === 'sample-sandbox'
                  ? 'sandbox_node.py (Editable)'
                  : `${selectedNodeId}.py`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {patchedToast && (
                <span className="text-xs text-emerald-400 font-mono flex items-center gap-1 animate-fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>Patched Successfully!</span>
                </span>
              )}
              {selectedNodeId === 'sample-sandbox' && (
                <button
                  onClick={handleResetSample}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Sample Code</span>
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
    </div>
  );
}
