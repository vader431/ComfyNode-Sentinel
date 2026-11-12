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
  BookOpen,
  Play,
  RotateCw,
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
  installedCount: number;
  isTauri?: boolean;
  onRefreshNodes?: () => void;
  onLaunchComfyUI?: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  installedCount,
  isTauri,
  onRefreshNodes,
  onLaunchComfyUI,
}: HeaderProps) {
  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'inspector', label: 'Installed Nodes', icon: Layers },
    { id: 'registry', label: 'Install Nodes', icon: Globe },
    { id: 'profiles', label: 'Missing Nodes', icon: Workflow },
    { id: 'doctor', label: 'Health Doctor', icon: Stethoscope },
    { id: 'models', label: 'Models & VRAM', icon: HardDrive },
    { id: 'lockfile', label: 'Sync & Backup', icon: FileCode2 },
    { id: 'runner', label: 'Console', icon: Terminal },
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
            <div>
              <span className="text-sm font-semibold tracking-tight text-white whitespace-nowrap block leading-tight">
                ComfyNode Sentinel
              </span>
              <span className="text-[10px] text-slate-500 font-mono block leading-none">
                Standalone Custom Nodes Manager
              </span>
            </div>
          </button>

          <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-500 font-mono ml-2 pl-3 border-l border-slate-800">
            {isTauri ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Desktop Native</span>
              </span>
            ) : (
              <span className="text-slate-400">Web Dashboard</span>
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

        {/* Zone 3: Manager Utility Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {onRefreshNodes && (
            <button
              onClick={onRefreshNodes}
              title="Rescan custom_nodes directory"
              className="p-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          {onLaunchComfyUI && (
            <button
              onClick={onLaunchComfyUI}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0"
              title="Launch ComfyUI in Terminal Console"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Launch ComfyUI</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('settings')}
            title="Environment & Binary Settings"
            className={`p-1.5 text-xs font-medium rounded-lg transition-colors border ${
              activeTab === 'settings'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            title="Help, Documentation & Roadmap"
            className={`p-1.5 text-xs font-medium rounded-lg transition-colors border ${
              activeTab === 'docs'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
