'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Terminal,
  ShieldCheck,
  FileCode2,
  Workflow,
  Cpu,
  Layers,
  Share2,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { RoadmapTask } from '@/types';

interface DocsViewProps {
  tasks: RoadmapTask[];
  onOpenExportModal: () => void;
  onNavigateToTab: (tabId: string) => void;
}

export function DocsView({
  tasks,
  onOpenExportModal,
  onNavigateToTab,
}: DocsViewProps) {
  const [activeSection, setActiveSection] = useState<'progress' | 'architecture' | 'ipc' | 'lockfile'>(
    'progress'
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const overallPercent = Math.round((completedTasks / (totalTasks || 1)) * 100);

  const phases = [
    {
      id: 'phase-0',
      title: 'Phase 0: Scaffolding & Setup Wizard',
      tag: 'P0 Setup',
      status: 'Completed',
      desc: 'Environment auto-detection (main.py, custom_nodes/), Python binary resolution (Windows Portable, venv, PATH), and persistent user preferences.',
      badge: '100% Done',
      tabTarget: 'settings',
    },
    {
      id: 'phase-1',
      title: 'Phase 1: Local Inspector (Offline MVP)',
      tag: 'P1 Inspector',
      status: 'Completed',
      desc: 'Local directory scanner, git commit/branch extraction, instant atomic state toggling (Folder <-> Folder.disabled), safe trash quarantine, and category/disk mini charts.',
      badge: '100% Done',
      tabTarget: 'inspector',
    },
    {
      id: 'phase-2',
      title: 'Phase 2: The Command Runner & Dependency Shield',
      tag: 'P2 Shield',
      status: 'Completed',
      desc: 'PTY streaming terminal log output, single-worker FIFO pip queue preventing site-packages lockups, and the interactive "Torch Shield" interceptor.',
      badge: '100% Done',
      tabTarget: 'runner',
    },
    {
      id: 'phase-3',
      title: 'Phase 3: Ingestion Channels (Registry, URL, Batch)',
      tag: 'P3 Ingest',
      status: 'Completed',
      desc: 'Curated 25+ node registry with class mappings, direct git clone modal with branch overrides, and batch URL importer (nodes.txt) with deduplication.',
      badge: '100% Done',
      tabTarget: 'registry',
    },
    {
      id: 'phase-4',
      title: 'Phase 4: Portability & Sync (The Lockfile Engine)',
      tag: 'P4 Lockfile',
      status: 'Completed',
      desc: 'comfy-lock.json schema generator & parser, plain urls.txt exporter, and 3-way reconciliation engine (clone missing, checkout commits, toggle states).',
      badge: '100% Done',
      tabTarget: 'lockfile',
    },
    {
      id: 'phase-5',
      title: 'Phase 5: Virtual Names & The "Health Doctor"',
      tag: 'P5 Doctor',
      status: 'Completed',
      desc: 'Virtual display names (aliases.json), Folder Normalizer tool (ComfyUI-[Name]), and Python AST linter flagging hardcoded imports and backslash paths with auto-patcher.',
      badge: '100% Done',
      tabTarget: 'doctor',
    },
    {
      id: 'phase-6',
      title: 'Phase 6: Workspace Profiles & Pre-Flight Inspector',
      tag: 'P6 Profiles',
      status: 'Completed',
      desc: 'Sub-2-second workspace profiles (Flux, Video, Portrait) and in-browser binary PNG chunk parser extracting embedded ComfyUI workflows (tEXt/iTXt).',
      badge: '100% Done',
      tabTarget: 'profiles',
    },
    {
      id: 'phase-7',
      title: 'Phase 7: Packaging & Multi-Platform Exporters',
      tag: 'P7 Release',
      status: 'Completed',
      desc: 'Tauri v2 release matrix, persistent logging architecture, and automated issue provisioners for GitHub CLI (gh), Linear CSV, and Notion Markdown.',
      badge: '100% Done',
      tabTarget: 'roadmap',
    },
  ];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sampleIpcCode = `// src-tauri/src/main.rs
#[tauri::command]
async fn validate_comfy_root(path: String) -> Result<ComfyRootValidation, String> {
    let root = std::path::Path::new(&path);
    let has_main = root.join("main.py").exists();
    let has_nodes = root.join("custom_nodes").is_dir();
    Ok(ComfyRootValidation { has_main, has_nodes, is_valid: has_main && has_nodes })
}

#[tauri::command]
async fn toggle_node_state(folder_name: String, enable: bool) -> Result<(), String> {
    let custom_nodes = get_custom_nodes_path()?;
    let from_path = if enable {
        custom_nodes.join(format!("{}.disabled", folder_name))
    } else {
        custom_nodes.join(&folder_name)
    };
    let to_path = if enable {
        custom_nodes.join(&folder_name)
    } else {
        custom_nodes.join(format!("{}.disabled", folder_name))
    };
    std::fs::rename(from_path, to_path).map_err(|e| e.to_string())
}`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Technical Manual & Milestones</span>
              <span aria-hidden="true">·</span>
              <span>ComfyNode Sentinel Architecture</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Documentation & Progress Tracker
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Comprehensive reference for Tauri v2/Rust backend bridges, the Torch Shield safety engine, comfy-lock.json specifications, and milestone progress.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Export Issues (GitHub/Linear/Notion)</span>
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>Implementation Backlog Status: All 8 Phases Implemented</span>
            <span className="text-emerald-400 font-semibold tabular-nums">
              {completedTasks} / {totalTasks} Tasks ({overallPercent}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Section Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
        <button
          onClick={() => setActiveSection('progress')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'progress'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Milestone Progress (Phases 0–7)</span>
        </button>

        <button
          onClick={() => setActiveSection('architecture')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'architecture'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>The &ldquo;Torch Shield&rdquo; & Pip Queue</span>
        </button>

        <button
          onClick={() => setActiveSection('lockfile')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'lockfile'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Lockfile Schema & Reconciliation</span>
        </button>

        <button
          onClick={() => setActiveSection('ipc')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'ipc'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span>Rust IPC Command Specification</span>
        </button>
      </div>

      {/* Section 1: Milestone Progress */}
      {activeSection === 'progress' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {phases.map((phase) => (
            <div
              key={phase.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      {phase.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                      <span className="text-emerald-400 font-medium">✓ {phase.status}</span>
                      <span aria-hidden="true">·</span>
                      <span>{phase.tag}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-[10px] font-mono text-emerald-300">
                    {phase.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  {phase.desc}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex justify-end">
                <button
                  onClick={() => onNavigateToTab(phase.tabTarget)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  <span>Open {phase.tag} Console</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section 2: Torch Shield & Pip Queue */}
      {activeSection === 'architecture' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                The &ldquo;Torch Shield&rdquo; Architecture (Phase 2)
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              When installing custom nodes via pip, many community repositories naively include <code>torch</code>, <code>torchvision</code>, or <code>torchaudio</code> in their <code>requirements.txt</code>. In standard ComfyUI portable or venv environments, running an unconstrained pip install triggers a PyTorch overwrite, which strips CUDA hardware acceleration and crashes models.
            </p>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 space-y-2">
              <div className="text-indigo-400 font-semibold">{'// Protection Pipeline Flow:'}</div>
              <div>1. Ingestion: Node repo cloned to custom_nodes/&lt;NodeName&gt;</div>
              <div>2. Pre-Scan: Inspect requirements.txt for regex: <code>^(torch|torchvision|torchaudio)</code></div>
              <div>3. Trigger Shield: If matched, set status: <strong>blocked_by_shield</strong></div>
              <div>4. User Prompt: &ldquo;This node tries to overwrite PyTorch. Strip it from install? [Yes (Recommended) / No]&rdquo;</div>
              <div>5. Sanitization: Strip PyTorch packages and feed sanitized requirements into the FIFO pip queue.</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">
                Sequential FIFO Pip Queue
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To eliminate Windows file lock crashes (<code>Access is denied: site-packages\...</code>) caused by concurrent pip processes accessing the same virtualenv, ComfyNode Sentinel enforces a strict single-worker FIFO channel. Only one pip process can execute at any time.
            </p>
          </div>
        </div>
      )}

      {/* Section 3: Lockfile Specification */}
      {activeSection === 'lockfile' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">
                  comfy-lock.json Schema Specification (Phase 4)
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              The lockfile schema guarantees 100% reproducible custom node environments across team workstations, developer machines, and cloud GPU pods (RunPod, Vast.ai, Modal).
            </p>

            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
{`{
  "version": "1.0.0",
  "generated_at": "2026-11-12T01:37:18.000Z",
  "comfyui_version": "v0.3.18-cu124",
  "nodes": [
    {
      "name": "ComfyUI-Impact-Pack",
      "url": "https://github.com/ltdrdata/ComfyUI-Impact-Pack.git",
      "commit_hash": "4f2b10a",
      "branch": "main",
      "enabled_state": true
    }
  ]
}`}
            </pre>
          </div>
        </div>
      )}

      {/* Section 4: Rust IPC Specification */}
      {activeSection === 'ipc' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">
                  Tauri v2 Rust IPC Command Handlers
                </h3>
              </div>

              <button
                onClick={() => handleCopy(sampleIpcCode, 'ipc')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded transition-colors"
              >
                {copiedCode === 'ipc' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode === 'ipc' ? 'Copied' : 'Copy Rust Code'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
              {sampleIpcCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
