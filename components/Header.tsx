'use client';

import React from 'react';
import {
  Layers,
  Terminal,
  Globe,
  FileCode2,
  Stethoscope,
  Workflow,
  HardDrive,
  Settings,
  Share2,
  BookOpen,
} from 'lucide-react';

export type ActiveTab =
  | 'roadmap'
  | 'inspector'
  | 'runner'
  | 'registry'
  | 'lockfile'
  | 'doctor'
  | 'profiles'
  | 'models'
  | 'settings'
  | 'docs';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenExportModal: () => void;
  installedCount: number;
  totalTasksCount?: number;
  completedTasksCount?: number;
  isTauri?: boolean;
}

export function Header({
  activeTab,
  setActiveTab,
  onOpenExportModal,
  installedCount,
  isTauri,
}: HeaderProps) {
  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'inspector', label: 'Nodes', icon: Layers },
    { id: 'registry', label: 'Registry', icon: Globe },
    { id: 'doctor', label: 'Health Doctor', icon: Stethoscope },
    { id: 'profiles', label: 'Workflows', icon: Workflow },
    { id: 'models', label: 'Models & VRAM', icon: HardDrive },
    { id: 'lockfile', label: 'Lockfile & Cloud', icon: FileCode2 },
    { id: 'runner', label: 'Terminal', icon: Terminal },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#070a10]/95 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between gap-4 px-6">
        {/* Zone 1: Wordmark brand title & Runtime Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('inspector')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 font-mono font-bold text-xs shadow-[0_0_12px_rgba(99,102,241,0.25)]">
              CS
            </div>
            <span className="text-sm font-semibold tracking-tight text-white whitespace-nowrap">
              ComfyNode Sentinel
            </span>
          </button>

          <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>Studio v2.1</span>
            <span aria-hidden="true">·</span>
            {isTauri ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Tauri Shell</span>
              </span>
            ) : (
              <span className="text-slate-400">Web Console</span>
            )}
          </div>
        </div>

        {/* Zone 2: Focused Core Navigation Links */}
        <nav className="flex items-center gap-1 text-sm overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.id === 'inspector' && (
                  <span className="text-[10px] text-indigo-300 font-mono ml-0.5 px-1.5 py-0.2 rounded bg-indigo-500/10 border border-indigo-500/20">
                    {installedCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Utility Actions (Docs, Settings, Export) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('docs')}
            title="Documentation, Rules & Changelog"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
              activeTab === 'docs'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Docs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            title="Environment Settings"
            className={`p-1.5 text-xs font-medium rounded-lg transition-colors border ${
              activeTab === 'settings'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
}
