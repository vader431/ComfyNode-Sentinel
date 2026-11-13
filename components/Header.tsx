'use client';

import React from 'react';
import {
  Play,
  RotateCw,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Menu,
  Terminal,
  Square,
  ExternalLink,
  Cpu,
  Zap,
  OctagonX,
} from 'lucide-react';
import { SentinelLogo } from './SentinelLogo';
import type { ComfyProcessStatus } from '@/lib/comfy-process';
import { summarizePrimaryGpu } from '@/lib/comfy-telemetry';
import type { ComfyInstance, ComfyLiveTelemetry, ComfyWsProgressState } from '@/types';
import pkg from '../package.json';

export type ActiveTab =
  | 'inspector'
  | 'registry'
  | 'updates'
  | 'doctor'
  | 'profiles'
  | 'models'
  | 'lockfile'
  | 'runner'
  | 'settings';

interface HeaderProps {
  setActiveTab: (tab: ActiveTab) => void;
  isValidRoot: boolean;
  autoTorchShield: boolean;
  isTauri?: boolean;
  isScanning?: boolean;
  onRefreshNodes?: () => void;
  onLaunchComfyUI?: () => void;
  onStopComfyUI?: () => void;
  onRestartComfyUI?: () => void;
  comfyProcessStatus?: ComfyProcessStatus;
  comfyProcessPid?: number | null;
  comfyPort?: number;
  comfyTelemetry?: ComfyLiveTelemetry | null;
  comfyWsState?: ComfyWsProgressState;
  onInterruptComfy?: () => void;
  onFreeComfyVram?: () => void;
  onOpenTelemetryDrawer?: () => void;
  instances?: ComfyInstance[];
  activeInstanceId?: string;
  onSwitchInstance?: (instanceId: string) => void;
  onToggleMobileMenu?: () => void;
  onToggleConsoleDrawer?: () => void;
  isConsoleDrawerOpen?: boolean;
}

export function Header({
  setActiveTab,
  isValidRoot,
  autoTorchShield,
  isTauri,
  isScanning,
  onRefreshNodes,
  onLaunchComfyUI,
  onStopComfyUI,
  onRestartComfyUI,
  comfyProcessStatus = 'stopped',
  comfyProcessPid = null,
  comfyPort = 8188,
  comfyTelemetry = null,
  comfyWsState,
  onInterruptComfy,
  onFreeComfyVram,
  onOpenTelemetryDrawer,
  instances = [],
  activeInstanceId,
  onSwitchInstance,
  onToggleMobileMenu,
  onToggleConsoleDrawer,
  isConsoleDrawerOpen,
}: HeaderProps) {
  const isComfyOnline = Boolean(comfyTelemetry?.online) || comfyProcessStatus === 'running';
  const primaryGpu = summarizePrimaryGpu(comfyTelemetry?.systemStats?.devices);
  const runningCount = comfyTelemetry?.queue.runningCount ?? 0;
  const pendingCount = comfyTelemetry?.queue.pendingCount ?? 0;
  const stepProgress = comfyWsState?.stepProgress ?? null;
  const executingNode = comfyWsState?.executingNode ?? null;
  const isGenerating = runningCount > 0 || Boolean(executingNode) || Boolean(stepProgress);

  const vramBarColor =
    primaryGpu?.pressureTone === 'critical'
      ? 'bg-rose-500'
      : primaryGpu?.pressureTone === 'elevated'
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <header className="sticky top-0 z-40 w-full h-12 border-b border-slate-800/80 bg-[#070a10]/95 backdrop-blur-md">
      <div className="flex h-full w-full items-center justify-between gap-2 px-4 lg:px-6">
        {/* Left: Mobile Menu + Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setActiveTab('inspector')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            <SentinelLogo className="w-7 h-7 shrink-0 drop-shadow-[0_0_10px_rgba(99,102,241,0.3)]" />
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight text-white whitespace-nowrap">
                ComfyNode Sentinel
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700/80 text-[10px] font-mono tabular-nums text-indigo-300">
                v{pkg.version}
              </span>
              <span className="hidden sm:inline text-[10px] text-slate-500 font-mono">
                {isTauri ? 'Desktop' : 'Standalone'}
              </span>
            </div>
          </button>
        </div>

        {/* Right: Instance Switcher, Live Telemetry Strip, Environment Status, Rescan, Console, Launch */}
        <div className="flex items-center gap-2 shrink-0">
          {instances.length > 0 && onSwitchInstance && (
            <select
              value={activeInstanceId || instances[0]?.id || ''}
              onChange={(e) => onSwitchInstance(e.target.value)}
              title="Switch ComfyUI Instance"
              className="hidden xl:block px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-medium text-slate-200 focus:outline-none focus:border-indigo-500 max-w-[160px] truncate"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} (:{inst.port})
                </option>
              ))}
            </select>
          )}

          {/* Live ComfyUI GPU & Queue Telemetry Strip */}
          {comfyTelemetry?.online && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121216] border border-slate-800/90 text-[11px] font-mono tabular-nums">
              <button
                type="button"
                onClick={onOpenTelemetryDrawer || onToggleConsoleDrawer}
                title={
                  primaryGpu
                    ? `${primaryGpu.deviceName} • VRAM ${primaryGpu.vramUsedGiB}/${primaryGpu.vramTotalGiB} GiB (${primaryGpu.vramPercent}%) — Click to inspect GPU & Queue`
                    : 'Open Live ComfyUI GPU & Queue Monitor'
                }
                className="flex items-center gap-2 text-left hover:text-white transition-colors"
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                {primaryGpu ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 font-semibold max-w-[96px] truncate">
                      {primaryGpu.shortName}
                    </span>
                    <div className="w-14 h-1.5 rounded-sm bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${vramBarColor}`}
                        style={{ width: `${primaryGpu.vramPercent}%` }}
                      />
                    </div>
                    <span
                      className={
                        primaryGpu.pressureTone === 'critical'
                          ? 'text-rose-300 font-semibold'
                          : primaryGpu.pressureTone === 'elevated'
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                      }
                    >
                      {primaryGpu.vramUsedGiB.toFixed(1)}/{primaryGpu.vramTotalGiB.toFixed(0)}G
                    </span>
                  </div>
                ) : (
                  <span className="text-emerald-300">:{comfyPort} Online</span>
                )}

                <span className="text-slate-700">|</span>

                {stepProgress ? (
                  <span className="flex items-center gap-1 text-indigo-300 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                    <span>
                      Step {stepProgress.value}/{stepProgress.max}
                    </span>
                  </span>
                ) : isGenerating ? (
                  <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      {executingNode ? `Node #${executingNode}` : `Run ${runningCount}`}
                      {pendingCount > 0 ? ` (+${pendingCount})` : ''}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Queue {pendingCount > 0 ? pendingCount : 'Idle'}
                  </span>
                )}
              </button>

              {isGenerating && onInterruptComfy && (
                <button
                  type="button"
                  onClick={onInterruptComfy}
                  title="Interrupt active ComfyUI generation (POST /interrupt)"
                  className="ml-1 p-1 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-700/60 text-rose-300 hover:text-white transition-colors"
                >
                  <OctagonX className="w-3 h-3" />
                </button>
              )}

              {onFreeComfyVram && (
                <button
                  type="button"
                  onClick={onFreeComfyVram}
                  title="Unload cached models & flush CUDA VRAM (POST /free)"
                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-indigo-300 hover:text-white transition-colors"
                >
                  <Zap className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => setActiveTab('settings')}
            title="Configure ComfyUI root directory"
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
              isValidRoot
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/70'
                : 'bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-950/70'
            }`}
          >
            {isValidRoot ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Not Configured</span>
              </>
            )}
          </button>

          <div
            title={autoTorchShield ? 'Torch Shield Active' : 'Torch Shield Bypassed'}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border ${
              autoTorchShield
                ? 'bg-slate-900 border-slate-800 text-indigo-300'
                : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
            }`}
          >
            {autoTorchShield ? (
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>Shield {autoTorchShield ? 'ON' : 'OFF'}</span>
          </div>

          {onToggleConsoleDrawer && (
            <button
              onClick={onToggleConsoleDrawer}
              title="Toggle Console & Live GPU Telemetry Drawer"
              className={`p-1.5 rounded-lg border transition-colors ${
                isConsoleDrawerOpen
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Terminal className="w-4 h-4" />
            </button>
          )}

          {onRefreshNodes && (
            <button
              onClick={onRefreshNodes}
              disabled={isScanning}
              title="Rescan custom_nodes directory"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors border border-slate-800"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Rescan</span>
            </button>
          )}

          {onLaunchComfyUI && (
            isComfyOnline || comfyProcessStatus === 'starting' ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  title={
                    comfyProcessPid
                      ? `Managed ComfyUI PID ${comfyProcessPid}`
                      : `ComfyUI reachable on 127.0.0.1:${comfyPort}`
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono tabular-nums rounded-lg border ${
                    isComfyOnline
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isComfyOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
                    }`}
                  />
                  <span className="hidden md:inline">
                    {isComfyOnline ? `Running :${comfyPort}` : 'Starting…'}
                  </span>
                </span>
                {isComfyOnline && (
                  <a
                    href={`http://127.0.0.1:${comfyPort}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open ComfyUI in browser"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {onRestartComfyUI && (comfyProcessStatus === 'running' || comfyProcessStatus === 'starting') && (
                  <button
                    onClick={onRestartComfyUI}
                    title="Restart Managed ComfyUI"
                    className="p-1.5 rounded-lg text-amber-300 hover:text-amber-200 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                )}
                {onStopComfyUI && (comfyProcessStatus === 'running' || comfyProcessStatus === 'starting') && (
                  <button
                    onClick={onStopComfyUI}
                    title="Stop Managed ComfyUI"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-sm"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={onLaunchComfyUI}
                disabled={!isValidRoot}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0"
                title={isValidRoot ? 'Launch Managed ComfyUI Process' : 'Configure ComfyUI path in Settings first'}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Launch ComfyUI</span>
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
