'use client';

import React, { useEffect, useRef } from 'react';
import {
  Terminal,
  X,
  Maximize2,
  Trash2,
  Cpu,
  Activity,
  Zap,
  OctagonX,
  Play,
  Layers,
} from 'lucide-react';
import { bytesToGiB } from '@/lib/comfy-telemetry';
import type {
  TerminalLogEntry,
  PipQueueItem,
  ComfyLiveTelemetry,
  ComfyWsProgressState,
} from '@/types';

export type ConsoleDrawerTab = 'logs' | 'telemetry';

interface ConsoleDrawerProps {
  isOpen: boolean;
  activeDrawerTab?: ConsoleDrawerTab;
  onChangeDrawerTab?: (tab: ConsoleDrawerTab) => void;
  logs: TerminalLogEntry[];
  pipQueue: PipQueueItem[];
  comfyTelemetry?: ComfyLiveTelemetry | null;
  comfyWsState?: ComfyWsProgressState;
  comfyPort?: number;
  isValidRoot?: boolean;
  onLaunchComfyUI?: () => void;
  onInterruptComfy?: () => void;
  onClearComfyQueue?: () => void;
  onDeleteComfyQueueItem?: (promptId: string) => void;
  onFreeComfyVram?: (unloadModels: boolean) => void;
  onClose: () => void;
  onExpandToFullTab: () => void;
  onClearLogs: () => void;
}

export function ConsoleDrawer({
  isOpen,
  activeDrawerTab = 'logs',
  onChangeDrawerTab,
  logs,
  pipQueue,
  comfyTelemetry = null,
  comfyWsState,
  comfyPort = 8188,
  isValidRoot = false,
  onLaunchComfyUI,
  onInterruptComfy,
  onClearComfyQueue,
  onDeleteComfyQueueItem,
  onFreeComfyVram,
  onClose,
  onExpandToFullTab,
  onClearLogs,
}: ConsoleDrawerProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && activeDrawerTab === 'logs') {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, activeDrawerTab, logs.length]);

  if (!isOpen) return null;

  const recentLogs = logs.slice(-80);
  const runningPipCount = pipQueue.filter((q) => q.status === 'running' || q.status === 'queued').length;
  const isComfyOnline = Boolean(comfyTelemetry?.online);
  const queueRunning = comfyTelemetry?.queue.runningItems ?? [];
  const queuePending = comfyTelemetry?.queue.pendingItems ?? [];
  const stepProgress = comfyWsState?.stepProgress ?? null;
  const executingNode = comfyWsState?.executingNode ?? null;
  const sys = comfyTelemetry?.systemStats?.system;
  const devices = comfyTelemetry?.systemStats?.devices ?? [];

  const ramTotalGiB = sys ? bytesToGiB(sys.ram_total) : 0;
  const ramUsedGiB = sys ? bytesToGiB(Math.max(0, sys.ram_total - sys.ram_free)) : 0;
  const ramPercent = sys && sys.ram_total > 0 ? Math.min(100, Math.round(((sys.ram_total - sys.ram_free) / sys.ram_total) * 100)) : 0;

  return (
    <div className="fixed bottom-7 left-0 lg:left-[220px] right-0 z-30 border-t border-slate-800 bg-[#070a10]/95 backdrop-blur-md shadow-2xl">
      {/* Header Bar with Tab Switcher */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-slate-800/80 bg-slate-950/70">
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => onChangeDrawerTab?.('logs')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              activeDrawerTab === 'logs'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Process Logs</span>
            {runningPipCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] tabular-nums">
                {runningPipCount} pip
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onChangeDrawerTab?.('telemetry')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors tabular-nums ${
              activeDrawerTab === 'telemetry'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Live GPU &amp; Queue</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isComfyOnline ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
            {isComfyOnline && (queueRunning.length > 0 || queuePending.length > 0) && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                {queueRunning.length} run / {queuePending.length} wait
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {activeDrawerTab === 'logs' && (
            <>
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
            </>
          )}
          <button
            onClick={onClose}
            title="Close drawer"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeDrawerTab === 'logs' ? (
        <div className="h-48 overflow-y-auto px-4 py-2 font-mono text-[11px] space-y-1">
          {recentLogs.length === 0 ? (
            <div className="text-slate-500 py-6 text-center">No console output yet.</div>
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
                  <span className="text-slate-600 shrink-0 tabular-nums">[{log.timestamp}]</span>
                  <span className={`${color} break-all whitespace-pre-wrap`}>{log.text}</span>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      ) : (
        <div className="h-56 overflow-y-auto px-4 py-3 font-mono text-xs tabular-nums">
          {!isComfyOnline ? (
            <div className="h-full flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-6 rounded-xl border border-slate-800/80 bg-slate-950/60">
              <div className="space-y-1 text-center sm:text-left">
                <div className="text-xs font-semibold text-slate-200 flex items-center justify-center sm:justify-start gap-2">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span>ComfyUI Server Offline on 127.0.0.1:{comfyPort}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans max-w-xl">
                  Start your ComfyUI instance to stream real-time GPU VRAM consumption, PyTorch allocator pressure, active WebSocket node execution, and prompt queue controls.
                </p>
              </div>
              {onLaunchComfyUI && (
                <button
                  type="button"
                  disabled={!isValidRoot}
                  onClick={onLaunchComfyUI}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-sans font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Launch ComfyUI (:{comfyPort})</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 7 cols: Hardware GPU & System RAM Telemetry */}
              <div className="lg:col-span-7 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-semibold text-white">Hardware &amp; CUDA Allocator</span>
                    {sys?.pytorch_version && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-indigo-300">
                        Torch {sys.pytorch_version}
                      </span>
                    )}
                    {sys?.python_version && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
                        Py {sys.python_version}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onFreeComfyVram && (
                      <>
                        <button
                          type="button"
                          onClick={() => onFreeComfyVram(false)}
                          title="Empty Torch CUDA cache without unloading models"
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-200 transition-colors"
                        >
                          Flush Cache
                        </button>
                        <button
                          type="button"
                          onClick={() => onFreeComfyVram(true)}
                          title="Unload all diffusion checkpoints from VRAM and flush CUDA cache"
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-[10px] font-semibold text-indigo-200 transition-colors"
                        >
                          <Zap className="w-3 h-3 text-indigo-400" />
                          <span>Unload Models &amp; Free VRAM</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {devices.map((dev) => {
                  const totalGiB = bytesToGiB(dev.vram_total);
                  const usedGiB = bytesToGiB(Math.max(0, dev.vram_total - dev.vram_free));
                  const vramPct =
                    dev.vram_total > 0
                      ? Math.min(100, Math.round(((dev.vram_total - dev.vram_free) / dev.vram_total) * 100))
                      : 0;
                  const torchUsedGiB = bytesToGiB(
                    Math.max(0, dev.torch_vram_total - dev.torch_vram_free)
                  );
                  const barColor =
                    vramPct >= 90
                      ? 'bg-rose-500'
                      : vramPct >= 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';

                  return (
                    <div
                      key={`${dev.type}-${dev.index}`}
                      className="p-2.5 rounded-lg border border-slate-800/90 bg-[#121216] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-200 truncate">
                          {dev.name}
                        </span>
                        <span className="text-slate-300">
                          VRAM:{' '}
                          <strong className="text-white">
                            {usedGiB.toFixed(2)} / {totalGiB.toFixed(2)} GiB
                          </strong>{' '}
                          ({vramPct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-sm bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${vramPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Torch Reserved Active: {torchUsedGiB.toFixed(2)} GiB</span>
                        <span>Free: {bytesToGiB(dev.vram_free).toFixed(2)} GiB</span>
                      </div>
                    </div>
                  );
                })}

                {sys && sys.ram_total > 0 && (
                  <div className="p-2 rounded-lg border border-slate-800/70 bg-slate-950/60 flex items-center justify-between gap-4 text-[11px]">
                    <span className="text-slate-400">System Host RAM</span>
                    <div className="flex items-center gap-2.5">
                      <div className="w-24 h-1.5 rounded-sm bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-sky-500 transition-all duration-300"
                          style={{ width: `${ramPercent}%` }}
                        />
                      </div>
                      <span className="text-slate-300">
                        {ramUsedGiB.toFixed(1)} / {ramTotalGiB.toFixed(1)} GiB ({ramPercent}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right 5 cols: Live WebSocket Execution & Prompt Queue */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-[11px]">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-semibold text-white">Prompt Queue &amp; Live WS</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        comfyWsState?.wsConnected
                          ? 'bg-emerald-950/70 border border-emerald-700/50 text-emerald-300'
                          : 'bg-slate-900 border border-slate-800 text-slate-400'
                      }`}
                    >
                      {comfyWsState?.wsConnected ? 'WS Live' : 'HTTP Poll'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(queueRunning.length > 0 || executingNode) && onInterruptComfy && (
                      <button
                        type="button"
                        onClick={onInterruptComfy}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-sans font-semibold transition-colors"
                      >
                        <OctagonX className="w-3 h-3" />
                        <span>Interrupt</span>
                      </button>
                    )}
                    {queuePending.length > 0 && onClearComfyQueue && (
                      <button
                        type="button"
                        onClick={onClearComfyQueue}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition-colors"
                      >
                        Clear Pending ({queuePending.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Live WS Step Progress Card */}
                {stepProgress || executingNode ? (
                  <div className="p-2.5 rounded-lg border border-indigo-500/40 bg-indigo-950/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-indigo-200 font-semibold">
                        Executing Node: {executingNode ? `#${executingNode}` : 'Active Graph'}
                      </span>
                      {stepProgress && (
                        <span className="text-indigo-300 font-semibold">
                          Step {stepProgress.value} / {stepProgress.max} (
                          {Math.round((stepProgress.value / stepProgress.max) * 100)}%)
                        </span>
                      )}
                    </div>
                    {stepProgress && (
                      <div className="w-full h-2 rounded-sm bg-slate-900 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all duration-150"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((stepProgress.value / stepProgress.max) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Queue List */}
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {queueRunning.length === 0 && queuePending.length === 0 ? (
                    <div className="p-3 rounded-lg border border-slate-800/70 bg-slate-950/50 text-slate-500 text-[11px] text-center">
                      ComfyUI execution queue is idle.
                    </div>
                  ) : (
                    <>
                      {queueRunning.map((item) => (
                        <div
                          key={item.promptId}
                          className="px-2.5 py-1.5 rounded border border-emerald-500/40 bg-emerald-950/20 flex items-center justify-between text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span className="text-emerald-200 font-semibold">
                              Running #{item.number}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              ({item.promptId.slice(0, 8)} • {item.nodeCount} nodes)
                            </span>
                          </div>
                        </div>
                      ))}

                      {queuePending.map((item) => (
                        <div
                          key={item.promptId}
                          className="px-2.5 py-1.5 rounded border border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-amber-300">Queued #{item.number}</span>
                            <span className="text-slate-500 text-[10px]">
                              ({item.promptId.slice(0, 8)} • {item.nodeCount} nodes)
                            </span>
                          </div>
                          {onDeleteComfyQueueItem && (
                            <button
                              type="button"
                              onClick={() => onDeleteComfyQueueItem(item.promptId)}
                              title="Remove from queue"
                              className="text-slate-400 hover:text-rose-400 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
