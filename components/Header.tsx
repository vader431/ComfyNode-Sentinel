'use client';

import React from 'react';
import {
  ListTodo,
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
  totalTasksCount: number;
  completedTasksCount: number;
  isTauri?: boolean;
}

export function Header({
  activeTab,
  setActiveTab,
  onOpenExportModal,
  installedCount,
  totalTasksCount,
  completedTasksCount,
  isTauri,
}: HeaderProps) {
  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'roadmap', label: 'Roadmap', icon: ListTodo },
    { id: 'inspector', label: 'Inspector', icon: Layers },
    { id: 'runner', label: 'Runner & Shield', icon: Terminal },
    { id: 'registry', label: 'Registry', icon: Globe },
    { id: 'lockfile', label: 'Lockfile', icon: FileCode2 },
    { id: 'doctor', label: 'Health Doctor', icon: Stethoscope },
    { id: 'profiles', label: 'Workflows', icon: Workflow },
    { id: 'models', label: 'Models & VRAM', icon: HardDrive },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'docs', label: 'Docs', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#070a10]/95 backdrop-blur-md">
      <div className="flex h-15 w-full items-center justify-between gap-4 px-6">
        {/* Zone 1: Wordmark brand title & Runtime Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('roadmap')}
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

        {/* Zone 2: Navigation Links, streamlined single-line text links */}
        <nav className="flex items-center gap-1 text-sm overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? 'bg-slate-800/90 text-white shadow-sm border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.id === 'roadmap' && (
                  <span className="text-[10px] text-slate-400 font-mono ml-0.5">
                    ({completedTasksCount}/{totalTasksCount})
                  </span>
                )}
                {item.id === 'inspector' && (
                  <span className="text-[10px] text-slate-400 font-mono ml-0.5">
                    ({installedCount})
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenExportModal}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Roadmap</span>
          </button>
        </div>
      </div>
    </header>
  );
}
