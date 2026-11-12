'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Terminal,
  ShieldCheck,
  FileCode2,
  Layers,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Scale,
  Sparkles,
  History,
  ListTodo,
  Download,
} from 'lucide-react';
import { RoadmapTask } from '@/types';

interface DocsViewProps {
  tasks: RoadmapTask[];
  onOpenExportModal: () => void;
  onNavigateToTab: (tabId: string) => void;
}

type DocsSection =
  | 'progress'
  | 'rules'
  | 'skill'
  | 'changelog'
  | 'todo'
  | 'architecture'
  | 'lockfile'
  | 'ipc';

export function DocsView({
  tasks,
  onOpenExportModal,
  onNavigateToTab,
}: DocsViewProps) {
  const [activeSection, setActiveSection] = useState<DocsSection>('progress');
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
      desc: 'Local directory scanner, git commit/branch extraction, instant atomic state toggling (Folder <-> Folder.disabled), safe trash quarantine, Storage Usage header, and interactive Category Pie Chart.',
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
      desc: 'Curated community node registry with class mappings, direct git clone modal with branch overrides, and batch URL importer (nodes.txt) with deduplication.',
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
      title: 'Phase 7: Packaging, Rules, Skill & Exporters',
      tag: 'P7 Release',
      status: 'Completed',
      desc: 'Project Rules (RULES.md), Agent Skill (SKILL.md), Changelog, TODO backlog, and automated issue provisioners for GitHub CLI (gh), Linear CSV, and Notion Markdown.',
      badge: '100% Done',
      tabTarget: 'roadmap',
    },
  ];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const rulesMarkdown = `# ComfyNode Sentinel — Project Engineering & AI Rules (/generate-rules)

## 1. Core Architectural Identity
- Application Name: ComfyNode Sentinel (ComfyUI Custom Node Manager & Desktop Companion)
- Web / Companion Stack: Next.js 15+ (App Router), React 19, TypeScript 5.9, Tailwind CSS v4, Lucide React
- Desktop Shell Target: Tauri v2 (Rust async runtime via tokio, serde, tauri-plugin-store, trash, reqwest, regex/ignore)

## 2. Strict Anti-Simulation & Code Quality Rules
1. Zero Truncation Policy: Never use "// TODO" or partial placeholders. Deliver complete end-to-end modules.
2. Real Data Persistence: Persist all state mutations immediately via StorageService (localStorage / tauri-plugin-store).
3. Binary & AST Parsing Authenticity:
   - Parse real binary PNG chunks (tEXt / iTXt) after the 8-byte PNG header.
   - Perform real line-by-line regex/AST inspection and deterministic Python auto-patching.
4. React 19 Compiler & Purity Compliance:
   - Never invoke Date.now() or Math.random() inside component render bodies.
   - Initialize persistent state via lazy useState(() => StorageService.get...()) initializers and useSyncExternalStore.

## 3. Domain Safety Invariants (ComfyUI Specific)
1. Atomic Node State Toggling: Rename custom_nodes/<Folder> <-> custom_nodes/<Folder>.disabled without deleting files.
2. Single-Worker FIFO Pip Queue: Execute only one pip install job at a time to prevent site-packages file locks.
3. Mandatory "Torch Shield" Pre-Check: Scan requirements.txt for ^(torch|torchvision|torchaudio|xformers) before pip runs.
4. Safe Deletion via Trash Quarantine: Move uninstalled nodes to recoverable Trash instead of permanent rm -rf.`;

  const skillMarkdown = `---
name: comfynode-sentinel-engineering
description: Domain-specific engineering skill for building, extending, and auditing ComfyNode Sentinel — covering ComfyUI custom node management, the Torch Shield pip interceptor, comfy-lock.json 3-way reconciliation, binary PNG workflow parsing, and Python AST health linting.
---

# ComfyNode Sentinel Engineering Skill (/generate-skill)

## 1. Module Responsibilities
- /types/index.ts: Canonical TypeScript interfaces for nodes, lockfiles, lint issues, profiles, and pip queue items.
- /lib/storage.ts: Persistent state repository backed by localStorage / tauri-plugin-store.
- /lib/png-metadata.ts: Binary PNG chunk reader (Uint8Array / DataView) extracting tEXt and iTXt ComfyUI workflow JSON.
- /lib/health-linter.ts: Static Python analyzer and automated patcher for hardcoded imports and Windows backslashes.
- /lib/lockfile.ts: comfy-lock.json generator, urls.txt exporter, and 3-way diff reconciliation calculator.

## 2. Core Engineering Patterns
1. Visual Telemetry (InspectorView): Compute storage & category totals via useMemo; format MB/GB dynamically; synchronize pie slice clicks with categoryFilter.
2. Torch Shield Interceptor (TerminalRunnerView): Match requirements against /^(torch|torchvision|torchaudio|xformers)(\\s*[<>=!~].*)?$/i and pause with status 'blocked_by_shield'.
3. 3-Way Lockfile Reconciliation (LockfileView): Classify diffs into install_missing, checkout_commit, toggle_state, and unlisted_local.`;

  const changelogMarkdown = `# Changelog

## [1.2.0] - 2026-11-12
### Added
- Interactive Category Composition Mini Pie Chart in InspectorView with Count vs Size (MB) metric toggle, dynamic donut-core hover details, and click-to-filter table synchronization.
- Header Storage Usage Summary component calculating and formatting total sizeMb across installed repositories in MB or GB.
- Generated Project Rules (/RULES.md), Agent Skill (/SKILL.md), Technical Documentation (/DOCUMENTATION.md), Changelog (/CHANGELOG.md), and Engineering TODO (/TODO.md).

## [1.1.0] - 2026-11-12
### Added
- 4-column Inspector KPI strip and ranked Disk Space Usage per Repository mini bar chart (Top 5 vs All toggle).
- In-app Documentation & Progress console (DocsView).
### Fixed
- Full React 19 compiler purity compliance (lazy state initializers, module-scoped ID generators, derived queue shield state).

## [1.0.0] - 2026-11-11
### Added
- Complete Phase 0–7 implementation: Setup Wizard, Local Inspector, Command Runner & Torch Shield, Registry/URL/Batch Ingestion, comfy-lock.json 3-Way Sync, Python Health Doctor & Auto-Patcher, Workspace Profiles & Binary PNG Workflow Inspector, and Multi-Platform Issue Exporters.`;

  const todoMarkdown = `# ComfyNode Sentinel — Engineering TODO & Backlog

## Completed Milestones (Phases 0–7)
- [x] Phase 0: ComfyUI root validator (main.py, custom_nodes/) & Python binary auto-detector
- [x] Phase 1: Local Inspector, atomic .disabled toggles, Trash bin, Storage Usage badge, Category Mini Pie Chart & Repo Disk Bar Chart
- [x] Phase 2: Streaming PTY Runner, Sequential FIFO Pip Queue & interactive "Torch Shield" interceptor
- [x] Phase 3: Curated Community Registry browser, Direct Git Clone modal & Batch nodes.txt importer
- [x] Phase 4: comfy-lock.json exporter, urls.txt generator & 3-Way Reconciliation Diff Engine
- [x] Phase 5: Virtual Display Aliases (aliases.json), Folder Normalizer & Python AST Health Doctor with 1-Click Auto-Patcher
- [x] Phase 6: Sub-2s Workspace Profiles & Binary PNG (tEXt/iTXt) / JSON Pre-Flight Workflow Inspector
- [x] Phase 7: GitHub CLI (.sh), Linear (.csv), Notion (.md) exporters + Project Rules, Skill, Docs & Changelog

## Upcoming Backlog (Phase 8: Post-1.0 Roadmap)
- [ ] Model Checkpoint & LoRA Symlink Deduplicator + VRAM Estimator
- [ ] Automated Git Bisect Rollback Assistant for broken upstream custom node updates
- [ ] Headless Cloud GPU Bootstrap Script Generator (RunPod / Vast.ai / Modal) from comfy-lock.json
- [ ] Global Python Dependency Conflict Matrix Detector across all enabled custom_nodes/`;

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
              <span>Technical Manual, Rules, Skill & Changelog</span>
              <span aria-hidden="true">·</span>
              <span>ComfyNode Sentinel v1.2.0</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Documentation, Rules, Skill & Progress Hub
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Complete engineering rules (<code>/generate-rules</code>), agent skill definition (<code>/generate-skill</code>), release changelog, TODO roadmap, and Tauri v2 / Rust IPC specifications.
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-2">
        <button
          onClick={() => setActiveSection('progress')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'progress'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Milestone Progress</span>
        </button>

        <button
          onClick={() => setActiveSection('rules')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'rules'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-3.5 h-3.5 text-cyan-400" />
          <span>Rules (RULES.md)</span>
        </button>

        <button
          onClick={() => setActiveSection('skill')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'skill'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>Agent Skill (SKILL.md)</span>
        </button>

        <button
          onClick={() => setActiveSection('changelog')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'changelog'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5 text-amber-400" />
          <span>Changelog</span>
        </button>

        <button
          onClick={() => setActiveSection('todo')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'todo'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
          <span>TODO & Roadmap</span>
        </button>

        <button
          onClick={() => setActiveSection('architecture')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'architecture'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Torch Shield & Pip Queue</span>
        </button>

        <button
          onClick={() => setActiveSection('lockfile')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'lockfile'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Lockfile Spec</span>
        </button>

        <button
          onClick={() => setActiveSection('ipc')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeSection === 'ipc'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span>Rust IPC Spec</span>
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

      {/* Section: Rules (/generate-rules) */}
      {activeSection === 'rules' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">
                Project Engineering & Domain Safety Rules (<code>/RULES.md</code>)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(rulesMarkdown, 'rules')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded transition-colors"
              >
                {copiedCode === 'rules' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode === 'rules' ? 'Copied' : 'Copy Rules'}</span>
              </button>
              <button
                onClick={() => handleDownloadFile('RULES.md', rulesMarkdown)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-950/60 border border-indigo-800/60 rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download RULES.md</span>
              </button>
            </div>
          </div>
          <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {rulesMarkdown}
          </pre>
        </div>
      )}

      {/* Section: Skill (/generate-skill) */}
      {activeSection === 'skill' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-semibold text-white">
                ComfyNode Sentinel Agent Skill Definition (<code>/SKILL.md</code>)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(skillMarkdown, 'skill')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded transition-colors"
              >
                {copiedCode === 'skill' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode === 'skill' ? 'Copied' : 'Copy SKILL.md'}</span>
              </button>
              <button
                onClick={() => handleDownloadFile('SKILL.md', skillMarkdown)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-950/60 border border-indigo-800/60 rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download SKILL.md</span>
              </button>
            </div>
          </div>
          <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {skillMarkdown}
          </pre>
        </div>
      )}

      {/* Section: Changelog */}
      {activeSection === 'changelog' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">
                Release Changelog (<code>/CHANGELOG.md</code>)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(changelogMarkdown, 'changelog')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded transition-colors"
              >
                {copiedCode === 'changelog' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode === 'changelog' ? 'Copied' : 'Copy Changelog'}</span>
              </button>
              <button
                onClick={() => handleDownloadFile('CHANGELOG.md', changelogMarkdown)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-950/60 border border-indigo-800/60 rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CHANGELOG.md</span>
              </button>
            </div>
          </div>
          <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {changelogMarkdown}
          </pre>
        </div>
      )}

      {/* Section: TODO & Roadmap */}
      {activeSection === 'todo' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                Engineering Checklist & Post-1.0 Roadmap (<code>/TODO.md</code>)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(todoMarkdown, 'todo')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded transition-colors"
              >
                {copiedCode === 'todo' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode === 'todo' ? 'Copied' : 'Copy TODO.md'}</span>
              </button>
              <button
                onClick={() => handleDownloadFile('TODO.md', todoMarkdown)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-950/60 border border-indigo-800/60 rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download TODO.md</span>
              </button>
            </div>
          </div>
          <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {todoMarkdown}
          </pre>
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
