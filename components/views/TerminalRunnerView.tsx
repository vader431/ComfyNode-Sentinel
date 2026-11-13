'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  Flame,
  Layers,
  Search,
  X,
} from 'lucide-react';
import { InstalledNode, PipQueueItem, TerminalLogEntry } from '@/types';
import { streamExecReal } from '@/lib/system-client';
import {
  isTorchProtectedRequirement,
  extractProtectedTorchPackages,
  stripProtectedTorchPackages,
} from '@/lib/torch-shield';

interface TerminalRunnerViewProps {
  logs: TerminalLogEntry[];
  pipQueue: PipQueueItem[];
  installedNodes?: InstalledNode[];
  onAddLog: (entry: Omit<TerminalLogEntry, 'id'>) => void;
  onClearLogs: () => void;
  onEnqueuePip: (nodeName: string, requirements: string[]) => void;
  onResolveShield: (queueItemId: string, stripTorch: boolean) => void;
  autoTorchShield: boolean;
  comfyRoot: string;
  pythonBinary?: string;
  initialCommand?: string;
}

export function TerminalRunnerView({
  logs,
  pipQueue,
  installedNodes = [],
  onAddLog,
  onClearLogs,
  onEnqueuePip,
  onResolveShield,
  autoTorchShield,
  comfyRoot,
  pythonBinary,
  initialCommand,
}: TerminalRunnerViewProps) {
  const [commandInput, setCommandInput] = useState(initialCommand || '');
  const [logFilterQuery, setLogFilterQuery] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const [selectedInstallNode, setSelectedInstallNode] = useState<string>('');
  const [customReqInput, setCustomReqInput] = useState<string>('');
  const [dryRunAnalysis, setDryRunAnalysis] = useState<{
    flagged: string[];
    safe: string[];
  } | null>(null);

  const shieldActivePendingItem =
    pipQueue.find((item) => item.status === 'blocked_by_shield') || null;
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const displayedLogs = React.useMemo(() => {
    if (!logFilterQuery.trim()) return logs;
    const q = logFilterQuery.toLowerCase();
    return logs.filter(
      (l) => l.text.toLowerCase().includes(q) || l.type.toLowerCase().includes(q)
    );
  }, [logs, logFilterQuery]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedLogs]);

  const handleAbortCommand = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      onAddLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'warn',
        text: 'Command aborted by user.',
      });
      setIsRunning(false);
    }
  };

  const handleRunCommand = async () => {
    if (!commandInput.trim() || isRunning) return;

    const cmd = commandInput.trim();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);

    onAddLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `$ ${cmd}`,
    });

    try {
      await streamExecReal(
        {
          command: cmd,
          comfyRoot,
          pythonBinary,
        },
        (line) => {
          onAddLog({
            timestamp: new Date().toLocaleTimeString(),
            type: line.type,
            text: line.text,
          });
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onAddLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'stderr',
          text: err instanceof Error ? err.message : 'Execution failed',
        });
      }
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  };

  const parsedInputLines = React.useMemo(
    () =>
      customReqInput
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#')),
    [customReqInput]
  );

  const handleDryRunCheck = () => {
    const flagged = extractProtectedTorchPackages(parsedInputLines);
    const safe = stripProtectedTorchPackages(parsedInputLines);
    setDryRunAnalysis({ flagged, safe });
  };

  const handleInstallRequirements = () => {
    if (parsedInputLines.length === 0) return;
    const label = selectedInstallNode || 'manual-requirements';
    onEnqueuePip(label, parsedInputLines);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Console &amp; Dependency Shield
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Strict FIFO sequential pip queue prevents site-packages corruption. The Torch Shield intercepts PyTorch, torchvision, torchaudio, and xformers overwrite attempts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
                autoTorchShield
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Torch Shield: {autoTorchShield ? 'Active' : 'Bypassed'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Torch Shield Modal / Callout if blocked */}
      {shieldActivePendingItem && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-200">
                Torch Shield Alert: PyTorch Overwrite Detected!
              </h3>
              <p className="text-xs text-amber-300/80 mt-1">
                Queue item <strong>{shieldActivePendingItem.nodeName}</strong> contains requirements trying to install or downgrade:{' '}
                <code className="bg-amber-900/60 px-1.5 py-0.5 rounded font-mono text-amber-200">
                  {shieldActivePendingItem.strippedTorchPackages.join(', ')}
                </code>
                . Overwriting PyTorch in ComfyUI can break your CUDA acceleration runtime.
              </p>

              {/* Split Before / After Diff using exact boundary matcher */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                  <div className="text-[10px] uppercase text-rose-400 font-bold mb-1">
                    Incoming requirements.txt (Blocked)
                  </div>
                  <div className="space-y-1">
                    {shieldActivePendingItem.requirements.map((req, i) => {
                      const isRisky = isTorchProtectedRequirement(req);
                      return (
                        <div
                          key={i}
                          className={
                            isRisky
                              ? 'text-rose-400 line-through bg-rose-950/40 px-1 rounded'
                              : 'text-slate-400'
                          }
                        >
                          {req} {isRisky && '(Strip)'}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                  <div className="text-[10px] uppercase text-emerald-400 font-bold mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Sanitized pip install Target</span>
                  </div>
                  <div className="space-y-1">
                    {stripProtectedTorchPackages(shieldActivePendingItem.requirements).map(
                      (req, i) => (
                        <div key={i} className="text-emerald-300 font-semibold">
                          ✓ {req}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => onResolveShield(shieldActivePendingItem.id, true)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors"
                >
                  Strip PyTorch from Install (Recommended)
                </button>
                <button
                  onClick={() => onResolveShield(shieldActivePendingItem.id, false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Install Anyway (Dangerous)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Terminal & Pip Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Terminal Screen (2 cols) */}
        <div className="lg:col-span-2 flex flex-col rounded-xl border border-slate-800 bg-[#070a0f] overflow-hidden shadow-lg h-[540px]">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-mono text-slate-400 ml-2">
                Process Runner (NDJSON stdout/stderr stream)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono">
                <Search className="w-3 h-3 text-slate-500" />
                <input
                  type="text"
                  value={logFilterQuery}
                  onChange={(e) => setLogFilterQuery(e.target.value)}
                  placeholder="Filter logs..."
                  className="bg-transparent border-none text-slate-200 placeholder:text-slate-600 focus:outline-none w-24 sm:w-36 text-xs"
                />
                {logFilterQuery && (
                  <button
                    onClick={() => setLogFilterQuery('')}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                onClick={onClearLogs}
                className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition-colors"
                title="Clear logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 leading-relaxed selection:bg-indigo-500/30">
            {displayedLogs.map((log) => {
              let colorClass = 'text-slate-300';
              if (log.type === 'stderr') colorClass = 'text-rose-400 font-semibold';
              if (log.type === 'shield') colorClass = 'text-amber-400 font-semibold';
              if (log.type === 'info') colorClass = 'text-indigo-400';
              if (log.type === 'success') colorClass = 'text-emerald-400';

              return (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-slate-600 text-[10px] tabular-nums shrink-0 select-none">
                    [{log.timestamp}]
                  </span>
                  <span className={`${colorClass} break-all whitespace-pre-wrap`}>
                    {log.text}
                  </span>
                </div>
              );
            })}
            <div ref={terminalEndRef} />
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-950 border-t border-slate-800/80">
            <span className="font-mono text-xs text-indigo-400 pl-1">$</span>
            <input
              type="text"
              placeholder="Run command in ComfyUI root (e.g. git status or python main.py --help)..."
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunCommand()}
              className="flex-1 bg-transparent border-0 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
            />
            <button
              onClick={isRunning ? handleAbortCommand : handleRunCommand}
              disabled={!isRunning && !commandInput.trim()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isRunning
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                  : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-sm'
              }`}
            >
              {isRunning ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>Abort</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Execute</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pip Queue & Requirements Shield Inspector (1 col) */}
        <div className="flex flex-col gap-6">
          {/* Sequential Pip Queue */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  Sequential Pip Queue (FIFO)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {pipQueue.length} jobs
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Executes one pip process at a time to eliminate site-packages file lock crashes.
            </p>

            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {pipQueue.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 font-mono">
                  Queue idle. Zero active pip locks.
                </div>
              ) : (
                pipQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{item.nodeName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {item.requirements.length} dependencies
                      </div>
                    </div>

                    <div>
                      {item.status === 'queued' && (
                        <span className="text-[10px] text-slate-400 font-mono">Queued</span>
                      )}
                      {item.status === 'running' && (
                        <span className="text-[10px] text-indigo-400 font-mono animate-pulse">
                          Running
                        </span>
                      )}
                      {item.status === 'blocked_by_shield' && (
                        <span className="text-[10px] text-amber-400 font-semibold font-mono">
                          Shield Blocked
                        </span>
                      )}
                      {item.status === 'completed' && (
                        <span className="text-[10px] text-emerald-400 font-mono">Done</span>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-[10px] text-rose-400 font-mono">Failed</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Requirements Inspector & Pip Installer */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                Shielded Pip Installer
              </h3>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Paste package specs or dry-run check lines with Torch Shield before queuing real <code>pip install</code>.
            </p>

            {installedNodes.length > 0 && (
              <select
                value={selectedInstallNode}
                onChange={(e) => setSelectedInstallNode(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              >
                <option value="">Target label: manual-requirements</option>
                {installedNodes.map((n) => (
                  <option key={n.id} value={n.folderName}>
                    {n.folderName}
                  </option>
                ))}
              </select>
            )}

            <textarea
              rows={4}
              value={customReqInput}
              onChange={(e) => {
                setCustomReqInput(e.target.value);
                setDryRunAnalysis(null);
              }}
              placeholder="e.g.&#10;einops>=0.7.0&#10;timm"
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
            />

            {dryRunAnalysis && (
              <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-[11px] font-mono space-y-1">
                <div className={dryRunAnalysis.flagged.length > 0 ? 'text-amber-300' : 'text-emerald-400'}>
                  {dryRunAnalysis.flagged.length > 0
                    ? `Shield flagged ${dryRunAnalysis.flagged.length}: ${dryRunAnalysis.flagged.join(', ')}`
                    : 'No protected torch packages detected.'}
                </div>
                <div className="text-slate-400">
                  Safe packages: {dryRunAnalysis.safe.length}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDryRunCheck}
                disabled={parsedInputLines.length === 0}
                className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg transition-colors"
              >
                Dry-Run Shield
              </button>
              <button
                type="button"
                onClick={handleInstallRequirements}
                disabled={parsedInputLines.length === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg transition-colors"
              >
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                <span>Pip Install</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
