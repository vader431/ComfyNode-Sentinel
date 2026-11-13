'use client';

import React from 'react';
import {
  Layers,
  Globe,
  RotateCw,
  Stethoscope,
  Workflow,
  HardDrive,
  FileCode2,
  Terminal,
  Settings,
  X,
} from 'lucide-react';
import { ActiveTab } from './Header';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  installedCount: number;
  updatesCount: number;
  healthIssuesCount: number;
  pipQueueBusyCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavGroup {
  label: string;
  items: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeTone?: 'indigo' | 'amber' | 'rose';
  }[];
}

export function Sidebar({
  activeTab,
  setActiveTab,
  installedCount,
  updatesCount,
  healthIssuesCount,
  pipQueueBusyCount,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const groups: NavGroup[] = [
    {
      label: 'Core',
      items: [
        {
          id: 'inspector',
          label: 'Installed Nodes',
          icon: Layers,
          badge: installedCount > 0 ? installedCount : undefined,
          badgeTone: 'indigo',
        },
        {
          id: 'registry',
          label: 'Install & Browse',
          icon: Globe,
        },
        {
          id: 'updates',
          label: 'Updates',
          icon: RotateCw,
          badge: updatesCount > 0 ? updatesCount : undefined,
          badgeTone: 'amber',
        },
      ],
    },
    {
      label: 'Diagnostics',
      items: [
        {
          id: 'doctor',
          label: 'Health Doctor',
          icon: Stethoscope,
          badge: healthIssuesCount > 0 ? healthIssuesCount : undefined,
          badgeTone: 'rose',
        },
        {
          id: 'profiles',
          label: 'Missing Nodes',
          icon: Workflow,
        },
        {
          id: 'models',
          label: 'Models & VRAM',
          icon: HardDrive,
        },
      ],
    },
    {
      label: 'System',
      items: [
        {
          id: 'lockfile',
          label: 'Sync & Backup',
          icon: FileCode2,
        },
        {
          id: 'runner',
          label: 'Console',
          icon: Terminal,
          badge: pipQueueBusyCount > 0 ? pipQueueBusyCount : undefined,
          badgeTone: 'amber',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
        },
      ],
    },
  ];

  const handleSelect = (id: ActiveTab) => {
    setActiveTab(id);
    onCloseMobile();
  };

  const badgeClasses = (tone: 'indigo' | 'amber' | 'rose' = 'indigo') => {
    if (tone === 'amber') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (tone === 'rose') return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
  };

  const navContent = (
    <div className="flex flex-col h-full py-4 px-3 space-y-6 select-none">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/15 text-white border border-indigo-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-indigo-400' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>

                  {typeof item.badge === 'number' && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono border ${badgeClasses(
                        item.badgeTone
                      )}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Rail */}
      <aside className="hidden lg:block w-[220px] shrink-0 border-r border-slate-800/80 bg-[#080c14]">
        <div className="sticky top-12 h-[calc(100vh-3rem-1.75rem)] overflow-y-auto">
          {navContent}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#080c14] border-r border-slate-800 h-full overflow-y-auto z-10">
            <div className="flex items-center justify-between px-4 h-12 border-b border-slate-800">
              <span className="text-xs font-semibold text-white">Navigation</span>
              <button
                onClick={onCloseMobile}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}

