'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal, X, Maximize2, Trash2 } from 'lucide-react';
import { TerminalLogEntry, PipQueueItem } from '@/types';

interface ConsoleDrawerProps {
  isOpen: boolean;
  logs: TerminalLogEntry[];
  pipQueue: PipQueueItem[];
  onClose: () => void;
  onExpandToFullTab: () => void;
  onClearLogs: () => void;
}

export function ConsoleDrawer({
  isOpen,
  logs,
  pipQueue,
  onClose,
  onExpandToFullTab,
  onClearLogs,
}: ConsoleDrawerProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, logs.length]);

  if (!isOpen) return null;

  const recentLogs = logs.slice(-80);
  const runningCount = pipQueue.filter((q) => q.status === 'running' || q.status === 'queued').length;

  return (
    <div className="fixed bottom-7 left-0 lg:left-[220px] right-0 z-30 border-t border-slate-800 bg-[#070a10]/95 backdrop-blur-md shadow-2xl">
      <div className="flex items-center justify-between px-4 h-9 border-b border-slate-800/80 bg-slate-950/70">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span>Console Quick-Peek</span>
          {runningCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
              {runningCount} pip active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onClearLogs}
            title="Clear logs"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onExpandToFullTab}
            title="Open full Console tab"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-indigo-300 hover:bg-slate-800"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Full Console</span>
          </button>
          <button
            onClick={onClose}
            title="Close drawer"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="h-44 overflow-y-auto px-4 py-2 font-mono text-[11px] space-y-1">
        {recentLogs.length === 0 ? (
          <div className="text-slate-500 py-4 text-center">No console output yet.</div>
        ) : (
          recentLogs.map((log) => {
            const color =
              log.type === 'stderr'
                ? 'text-rose-400'
                : log.type === 'success'
                ? 'text-emerald-400'
                : log.type === 'warn'
                ? 'text-amber-300'
                : log.type === 'shield'
                ? 'text-amber-400'
                : log.type === 'info'
                ? 'text-sky-400'
                : 'text-slate-300';
            return (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                <span className={`${color} break-all whitespace-pre-wrap`}>{log.text}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

