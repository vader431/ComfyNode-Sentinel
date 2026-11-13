'use client';

import React from 'react';
import {
  Folder,
  Terminal,
  Monitor,
  ShieldCheck,
} from 'lucide-react';
import { PipQueueItem } from '@/types';

interface StatusBarProps {
  comfyRoot: string;
  pipQueue: PipQueueItem[];
  isTauri: boolean;
  onNavigateToSettings: () => void;
  onNavigateToRunner: () => void;
}

export function StatusBar({
  comfyRoot,
  pipQueue,
  isTauri,
  onNavigateToSettings,
  onNavigateToRunner,
}: StatusBarProps) {
  const activeJob = pipQueue.find((q) => q.status === 'running');
  const pendingJobs = pipQueue.filter((q) => q.status === 'queued').length;
  const blockedJob = pipQueue.find((q) => q.status === 'blocked_by_shield');

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 h-7 border-t border-slate-800/80 bg-[#070a10]/95 backdrop-blur-md px-4 flex items-center justify-between text-[11px] font-mono select-none text-slate-400">
      {/* Left: Environment Root Path */}
      <div className="flex items-center gap-4">
        <button
          onClick={onNavigateToSettings}
          title="Click to configure environment"
          className="flex items-center gap-1.5 hover:text-slate-200 transition-colors truncate max-w-[280px] sm:max-w-[420px]"
        >
          <Folder className="w-3 h-3 text-indigo-400 shrink-0" />
          <span className="truncate">{comfyRoot || 'No ComfyUI Root Selected'}</span>
        </button>
      </div>

      {/* Right: Pip Queue & Tauri Status */}
      <div className="flex items-center gap-4">
        {/* Pip Queue Status Indicator */}
        <button
          onClick={onNavigateToRunner}
          title="View Terminal & Pip Queue"
          className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
        >
          {blockedJob ? (
            <span className="flex items-center gap-1 text-rose-400 font-bold animate-pulse">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
              <span>Shield Blocked: {blockedJob.nodeName}</span>
            </span>
          ) : activeJob ? (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>Installing: {activeJob.nodeName} {pendingJobs > 0 && `(+${pendingJobs})`}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500 hover:text-slate-400">
              <Terminal className="w-3 h-3" />
              <span>Pip Queue: Idle</span>
            </span>
          )}
        </button>

        {/* Runtime Shell Badge */}
        <div className="flex items-center gap-1.5 pl-3 border-l border-slate-800 text-[10px]">
          {isTauri ? (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>Tauri v2 Desktop</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500">
              <Monitor className="w-3 h-3 text-slate-500" />
              <span>Web Console</span>
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}

