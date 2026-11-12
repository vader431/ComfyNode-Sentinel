'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  ShieldAlert,
  ShieldCheck,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Flame,
  Layers,
  Search,
  X,
  ArrowRight,
} from 'lucide-react';
import { PipQueueItem, TerminalLogEntry } from '@/types';

interface TerminalRunnerViewProps {
  logs: TerminalLogEntry[];
  pipQueue: PipQueueItem[];
  onAddLog: (entry: Omit<TerminalLogEntry, 'id'>) => void;
  onClearLogs: () => void;
  onEnqueuePip: (nodeName: string, requirements: string[]) => void;
  onResolveShield: (queueItemId: string, stripTorch: boolean) => void;
  autoTorchShield: boolean;
  initialCommand?: string;
}

export function TerminalRunnerView({
  logs,
  pipQueue,
  onAddLog,
  onClearLogs,
  onEnqueuePip,
  onResolveShield,
  autoTorchShield,
  initialCommand,
}: TerminalRunnerViewProps) {
  const [commandInput, setCommandInput] = useState(initialCommand || '');
  const [logFilterQuery, setLogFilterQuery] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const [customReqInput, setCustomReqInput] = useState(
    `# Sample requirements.txt with dangerous PyTorch override\ntransformers>=4.41.0\neinops\ntorch==2.1.2+cu121\ntorchvision>=0.16.2\nscipy>=1.11.0`
  );
  
  // Derived state directly from pipQueue
  const shieldActivePendingItem = pipQueue.find((item) => item.status === 'blocked_by_shield') || null;
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const displayedLogs = React.useMemo(() => {
    if (!logFilterQuery.trim()) return logs;
    const q = logFilterQuery.toLowerCase();
    return logs.filter((l) => l.text.toLowerCase().includes(q) || l.type.toLowerCase().includes(q));
  }, [logs, logFilterQuery]);

  // Auto-scroll logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedLogs]);

  const handleRunCommand = () => {
    if (!commandInput.trim() || isRunning) return;

    setIsRunning(true);
    const cmd = commandInput.trim();

    onAddLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `$ ${cmd}`,
    });

    // Simulate async line streaming
    setTimeout(() => {
      onAddLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stdout',
        text: `Executing in C:\\AI\\ComfyUI_windows_portable\\ComfyUI...`,
      });
    }, 200);

    setTimeout(() => {
      if (cmd.includes('pip install')) {
        onAddLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'info',
          text: `[Pip Queue Manager] Validating site-packages lock invariants...`,
        });
        onAddLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'stdout',
          text: `Successfully resolved dependencies. Zero site-package lock contentions detected.`,
        });
      } else if (cmd.includes('git pull')) {
        onAddLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'stdout',
          text: `Updating 9a4c8e1..4f2b10a\nFast-forward\n requirements.txt | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)`,
        });
      } else {
        onAddLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'stdout',
          text: `Process finished with exit code 0.`,
        });
      }
      setIsRunning(false);
    }, 1000);
  };

  const handleTestRequirementsShield = () => {
    const lines = customReqInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    onEnqueuePip('Sandbox-Test-Node', lines);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Streaming Execution Engine</span>
              <span aria-hidden="true">·</span>
              <span>The &ldquo;Torch Shield&rdquo; (Phase 2)</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Command Runner & Dependency Shield
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Strict FIFO sequential pip queue prevents site-packages corruption. The Torch Shield automatically intercepts and strips accidental PyTorch downgrades.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Torch Shield: {autoTorchShield ? 'Active' : 'Bypassed'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Torch Shield Modal / Callout if blocked */}
      {shieldActivePendingItem && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-5 shadow-lg animate-pulse">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-200">
                Torch Shield Alert: PyTorch Overwrite Detected!
              </h3>
              <p className="text-xs text-amber-300/80 mt-1">
                Node <strong>{shieldActivePendingItem.nodeName}</strong> contains requirements trying to install or downgrade:{' '}
                <code className="bg-amber-900/60 px-1.5 py-0.5 rounded font-mono text-amber-200">
                  {shieldActivePendingItem.strippedTorchPackages.join(', ')}
                </code>.
                Overwriting PyTorch in ComfyUI will break your CUDA acceleration and torch xformers runtime!
              </p>

              {/* Split Before / After Diff */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                  <div className="text-[10px] uppercase text-rose-400 font-bold mb-1">
                    Incoming requirements.txt (Blocked)
                  </div>
                  <div className="space-y-1">
                    {shieldActivePendingItem.requirements.map((req, i) => {
                      const isRisky = shieldActivePendingItem.strippedTorchPackages.some((p) =>
                        req.toLowerCase().startsWith(p)
                      );
                      return (
                        <div
                          key={i}
                          className={isRisky ? 'text-rose-400 line-through bg-rose-950/40 px-1 rounded' : 'text-slate-400'}
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
                    {shieldActivePendingItem.requirements
                      .filter(
                        (req) =>
                          !shieldActivePendingItem.strippedTorchPackages.some((p) =>
                            req.toLowerCase().startsWith(p)
                          )
                      )
                      .map((req, i) => (
                        <div key={i} className="text-emerald-300 font-semibold">
                          ✓ {req}
                        </div>
                      ))}
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
          {/* Terminal Titlebar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-mono text-slate-400 ml-2">
                tokio::process::Command (PTY stdout)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* In-Terminal Search Filter */}
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

          {/* Terminal Output Area */}
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

          {/* Terminal Command Input */}
          <div className="flex items-center gap-2 p-3 bg-slate-950 border-t border-slate-800/80">
            <span className="font-mono text-xs text-indigo-400 pl-1">$</span>
            <input
              type="text"
              placeholder="Run command (e.g. pip install -r requirements.txt or git pull)..."
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunCommand()}
              className="flex-1 bg-transparent border-0 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
            />
            <button
              onClick={handleRunCommand}
              disabled={isRunning || !commandInput.trim()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isRunning
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
              }`}
            >
              {isRunning ? (
                <>
                  <Square className="w-3 h-3 fill-current text-amber-400" />
                  <span>Running</span>
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

        {/* Pip Queue & Torch Shield Sandbox (1 col) */}
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
              Enforces single-threaded pip execution to eliminate file lockup crashes on Windows and shared environments.
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
                      <div className="font-semibold text-slate-200">
                        {item.nodeName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {item.requirements.length} dependencies
                      </div>
                    </div>

                    <div>
                      {item.status === 'queued' && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Queued
                        </span>
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
                        <span className="text-[10px] text-emerald-400 font-mono">
                          Done
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Torch Shield Interactive Sandbox */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 pb-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                Torch Shield Sandbox
              </h3>
            </div>

            <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
              Paste or edit sample <code>requirements.txt</code> below to test the automatic PyTorch protection interceptor:
            </p>

            <textarea
              rows={4}
              value={customReqInput}
              onChange={(e) => setCustomReqInput(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
            />

            <button
              onClick={handleTestRequirementsShield}
              className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Pip Install Through Shield</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
