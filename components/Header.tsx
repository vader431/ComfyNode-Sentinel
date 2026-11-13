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
} from 'lucide-react';
import { SentinelLogo } from './SentinelLogo';

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
  onToggleMobileMenu,
  onToggleConsoleDrawer,
  isConsoleDrawerOpen,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full h-12 border-b border-slate-800/80 bg-[#070a10]/95 backdrop-blur-md">
      <div className="flex h-full w-full items-center justify-between gap-3 px-4 lg:px-6">
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
              <span className="hidden sm:inline text-[10px] text-slate-500 font-mono">
                {isTauri ? 'Desktop' : 'Standalone'}
              </span>
            </div>
          </button>
        </div>

        {/* Right: Environment Pill, Rescan, Console Drawer, Torch Shield, Launch */}
        <div className="flex items-center gap-2 shrink-0">
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
              title="Toggle Console Quick-Peek Drawer"
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
            <button
              onClick={onLaunchComfyUI}
              disabled={!isValidRoot}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0"
              title={isValidRoot ? 'Launch ComfyUI in Console' : 'Configure ComfyUI path in Settings first'}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Launch ComfyUI</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
