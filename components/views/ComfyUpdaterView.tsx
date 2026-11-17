'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpCircle,
  RefreshCw,
  Download,
  RotateCcw,
  CheckCircle2,
  Search,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  Loader2,
  GitBranch,
  GitCommit,
  PackageCheck,
} from 'lucide-react';
import type { CoreStatusResponse } from '@/lib/core-updater';
import type { TerminalLogEntry } from '@/types';

interface ComfyUpdaterViewProps {
  comfyRoot: string;
  isValidRoot: boolean;
  onAddLog?: (entry: Omit<TerminalLogEntry, 'id'>) => void;
  onNotify?: (tone: 'info' | 'success' | 'warn' | 'error', title: string, detail?: string) => void;
  onNavigateToSettings?: () => void;
  onEnqueueCoreRequirements?: (label: string, requirements: string[]) => void;
}

interface GitOpProgress {
  phase: string;
  percent: number;
  label: string;
}

export function ComfyUpdaterView({
  comfyRoot,
  isValidRoot,
  onAddLog,
  onNotify,
  onNavigateToSettings,
  onEnqueueCoreRequirements,
}: ComfyUpdaterViewProps) {
  const [status, setStatus] = useState<CoreStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [gitProgress, setGitProgress] = useState<GitOpProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [previousCommit, setPreviousCommit] = useState<string | null>(null);
  const [autoSyncReqs, setAutoSyncReqs] = useState(false);
  const [requirementsChanged, setRequirementsChanged] = useState(false);

  const fetchCoreStatus = useCallback(async () => {
    if (!comfyRoot || !isValidRoot) return null;
    const res = await fetch('/api/environment/core', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', comfyRoot }),
    });
    const data = (await res.json()) as CoreStatusResponse;
    return { ok: res.ok, data };
  }, [comfyRoot, isValidRoot]);

  const loadStatus = useCallback(async () => {
    if (!comfyRoot || !isValidRoot) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await fetchCoreStatus();
      if (!result) return;
      if (!result.ok || result.data.error) {
        setErrorMsg(result.data.error || 'Failed to inspect ComfyUI Core.');
      } else {
        setStatus(result.data);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to inspect ComfyUI Core.');
    } finally {
      setIsLoading(false);
    }
  }, [comfyRoot, isValidRoot, fetchCoreStatus]);

  useEffect(() => {
    if (!isValidRoot || !comfyRoot) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (!cancelled) setIsLoading(true);
        return fetchCoreStatus();
      })
      .then((result) => {
        if (cancelled || !result) return;
        if (!result.ok || result.data.error) {
          setErrorMsg(result.data.error || 'Failed to inspect ComfyUI Core.');
        } else {
          setStatus(result.data);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Failed to inspect ComfyUI Core.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [comfyRoot, isValidRoot, fetchCoreStatus]);

  const runStreamingCoreOp = async (action: 'update' | 'checkout', ref?: string) => {
    if (!isValidRoot) {
      onNavigateToSettings?.();
      return;
    }

    const opLabel = action === 'update' ? 'Updating ComfyUI Core to latest…' : `Switching ComfyUI Core to ${ref}…`;
    setActiveRef(action === 'update' ? '__latest__' : ref || '__checkout__');
    setErrorMsg(null);
    setStatusMsg(null);
    setRequirementsChanged(false);
    setGitProgress({ phase: 'Preparing git', percent: 0, label: opLabel });

    onAddLog?.({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[ComfyUI Core] ${opLabel}`,
    });

    try {
      const res = await fetch('/api/environment/core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comfyRoot,
          ref,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || `Core ${action} failed (HTTP ${res.status})`);
      }

      if (!res.body) {
        throw new Error('Streaming response body unavailable.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let donePayload: (CoreStatusResponse & {
        previousCommit?: string;
        updated?: boolean;
        requirementsChanged?: boolean;
      }) | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line) as {
            type: string;
            phase?: string;
            percent?: number;
            error?: string;
          } & Partial<CoreStatusResponse> & {
              previousCommit?: string;
              updated?: boolean;
              requirementsChanged?: boolean;
            };

          if (evt.type === 'progress') {
            setGitProgress({
              phase: evt.phase || 'Running git',
              percent: typeof evt.percent === 'number' ? evt.percent : 0,
              label: opLabel,
            });
          } else if (evt.type === 'error') {
            throw new Error(evt.error || 'ComfyUI Core git operation failed.');
          } else if (evt.type === 'done') {
            donePayload = evt as CoreStatusResponse & {
              previousCommit?: string;
              updated?: boolean;
              requirementsChanged?: boolean;
            };
          }
        }
      }

      if (donePayload) {
        if (donePayload.previousCommit && donePayload.previousCommit !== donePayload.commit) {
          setPreviousCommit(donePayload.previousCommit);
        }
        const reqsChanged = Boolean(donePayload.requirementsChanged);
        setRequirementsChanged(reqsChanged);

        const summary =
          action === 'update'
            ? donePayload.updated
              ? `Updated ComfyUI Core (${donePayload.previousCommit} → ${donePayload.commit}).`
              : `ComfyUI Core is already up to date (${donePayload.commit}).`
            : `Switched ComfyUI Core to ${ref} (${donePayload.commit}).`;

        setStatusMsg(summary);
        onAddLog?.({
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          text: `[ComfyUI Core] ${summary}`,
        });
        onNotify?.('success', 'ComfyUI Core Updated', summary);

        if (
          autoSyncReqs &&
          donePayload.coreRequirements &&
          donePayload.coreRequirements.length > 0 &&
          onEnqueueCoreRequirements
        ) {
          onEnqueueCoreRequirements('ComfyUI Core', donePayload.coreRequirements);
        }
      }

      await loadStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ComfyUI Core update failed.';
      setErrorMsg(msg);
      onAddLog?.({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: `[ComfyUI Core Error] ${msg}`,
      });
      onNotify?.('error', 'ComfyUI Core Update Failed', msg);
    } finally {
      setActiveRef(null);
      setGitProgress(null);
    }
  };

  const releases = status?.releases ?? [];
  const filteredReleases = releases.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return r.tag.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
  });

  const isBusy = activeRef !== null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                ComfyUI Core Updater
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Inspect your ComfyUI core repository version, pull upstream commits, or switch/roll back to any release tag.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="https://github.com/comfyanonymous/ComfyUI/releases"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>GitHub Releases</span>
            </a>

            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={isLoading || isBusy || !isValidRoot}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Checking…' : 'Check Updates'}</span>
            </button>

            {status?.isGitRepo && (
              <button
                type="button"
                onClick={() => void runStreamingCoreOp('update')}
                disabled={isBusy || isLoading || status.isDirty}
                title={
                  status.isDirty
                    ? 'Commit or stash local changes before updating'
                    : 'Pull latest upstream commits (git pull --ff-only)'
                }
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{activeRef === '__latest__' ? 'Updating…' : 'Update to Latest'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Opt-in requirements.txt sync checkbox */}
        {status?.hasRequirementsTxt && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSyncReqs}
                onChange={(e) => setAutoSyncReqs(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
              />
              <span>
                Install core <code className="font-mono text-indigo-300">requirements.txt</code> after update (FIFO Pip Queue + Torch Shield)
              </span>
            </label>

            {onEnqueueCoreRequirements && status.coreRequirements && status.coreRequirements.length > 0 && (
              <button
                type="button"
                onClick={() => onEnqueueCoreRequirements('ComfyUI Core', status.coreRequirements!)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  requirementsChanged
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 hover:bg-amber-500/30'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>
                  {requirementsChanged
                    ? 'requirements.txt changed — Sync Now'
                    : 'Sync Core requirements.txt'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Root Guard */}
      {!isValidRoot && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              ComfyUI root directory is not configured on disk. Configure it in Settings before checking or updating ComfyUI Core.
            </span>
          </div>
          {onNavigateToSettings && (
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0 transition-colors"
            >
              Open Settings
            </button>
          )}
        </div>
      )}

      {/* Live Git Transfer Progress Bar */}
      {gitProgress && (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/20 p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-indigo-200 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>
                {gitProgress.label} ({gitProgress.phase})
              </span>
            </div>
            <span className="font-mono text-indigo-300 font-semibold tabular-nums">
              {gitProgress.percent}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-150"
              style={{ width: `${Math.min(100, Math.max(0, gitProgress.percent))}%` }}
            />
          </div>
        </div>
      )}

      {/* Feedback Banners */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {statusMsg && (
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMsg}</span>
          </div>
          <button type="button" onClick={() => setStatusMsg(null)} className="opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Installed Core */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Installed ComfyUI Core
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-white font-mono">
                {status.version ? `v${status.version.replace(/^v/i, '')}` : status.tag || 'Unknown'}
              </span>
              {status.isDetached && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                  Detached HEAD
                </span>
              )}
              {status.isDirty && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-[10px] font-mono text-rose-300">
                  Uncommitted Changes
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              {status.isGitRepo ? (
                <>
                  <span className="inline-flex items-center gap-1">
                    <GitBranch className="w-3 h-3 text-slate-500" />
                    {status.branch}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GitCommit className="w-3 h-3 text-slate-500" />
                    {status.commit}
                  </span>
                </>
              ) : (
                <span>Portable Snapshot (no .git)</span>
              )}
            </div>
          </div>

          {/* Upstream Status */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Upstream Status
            </div>
            {!status.isGitRepo ? (
              <div className="text-xs text-amber-300 leading-relaxed">
                {status.message || 'No .git repository detected. Use git clone for in-place updates.'}
              </div>
            ) : status.hasUpdate ? (
              <>
                <div className="text-lg font-bold text-amber-300 font-mono">
                  {status.behindCount} commit{status.behindCount === 1 ? '' : 's'} behind
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Latest release: {status.latestReleaseTag || '—'}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-emerald-400 font-mono">Up to date</div>
                <div className="text-xs text-slate-400 font-mono">
                  Latest release: {status.latestReleaseTag || '—'}
                </div>
              </>
            )}
          </div>

          {/* Rollback / Branch Recovery */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Quick Recovery
            </div>
            {previousCommit ? (
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-300 font-mono">
                  Previous: <span className="text-indigo-300">{previousCommit}</span>
                </div>
                <button
                  type="button"
                  disabled={isBusy || status.isDirty}
                  onClick={() => void runStreamingCoreOp('checkout', previousCommit)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Rollback</span>
                </button>
              </div>
            ) : status.isDetached && status.defaultBranch ? (
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-400">
                  Pinned to tag. Return to <code className="text-slate-200">{status.defaultBranch}</code>:
                </div>
                <button
                  type="button"
                  disabled={isBusy || status.isDirty}
                  onClick={() => void runStreamingCoreOp('checkout', status.defaultBranch!)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-50 transition-colors"
                >
                  <GitBranch className="w-3 h-3" />
                  <span>Checkout {status.defaultBranch}</span>
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Select any release tag below to switch versions or roll back.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incoming Commits */}
      {status?.incomingCommits && status.incomingCommits.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Incoming Upstream Commits ({status.incomingCommits.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-800/60 max-h-56 overflow-y-auto">
            {status.incomingCommits.map((c) => (
              <div key={c.hash} className="px-4 py-2 flex items-center gap-3 text-xs">
                <span className="font-mono text-indigo-300 shrink-0">{c.hash}</span>
                <span className="text-slate-300 truncate">{c.subject}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Releases / Tag Switcher Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">ComfyUI Releases &amp; Tags</h2>
            <p className="text-[11px] text-slate-400">
              Switch to or roll back to any tagged ComfyUI release.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter tags (e.g. v0.3)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-800/70 max-h-[420px] overflow-y-auto">
          {filteredReleases.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {isLoading ? 'Loading ComfyUI releases…' : 'No matching ComfyUI releases found.'}
            </div>
          ) : (
            filteredReleases.map((rel, idx) => {
              const isCurrent =
                status?.tag?.toLowerCase() === rel.tag.toLowerCase() ||
                (status?.version &&
                  `v${status.version.replace(/^v/i, '')}`.toLowerCase() === rel.tag.toLowerCase());
              const isLatest = idx === 0 && !searchQuery.trim();
              const isSwitchingThis = activeRef === rel.tag;

              return (
                <div
                  key={rel.tag}
                  className={`px-4 py-3 flex items-center justify-between gap-4 transition-colors ${
                    isCurrent ? 'bg-emerald-950/15' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-slate-100">
                        {rel.tag}
                      </span>
                      {rel.name !== rel.tag && (
                        <span className="text-xs text-slate-400 truncate">{rel.name}</span>
                      )}
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-300">
                          Current
                        </span>
                      )}
                      {isLatest && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-mono text-indigo-300">
                          Latest
                        </span>
                      )}
                      {rel.isPrerelease && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                          Pre-release
                        </span>
                      )}
                    </div>
                    {rel.publishedAt && (
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Released {new Date(rel.publishedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={rel.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                      title="View release notes on GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {!isCurrent && (
                      <button
                        type="button"
                        disabled={!status?.isGitRepo || isBusy || Boolean(status?.isDirty)}
                        title={
                          !status?.isGitRepo
                            ? 'Requires a .git ComfyUI installation'
                            : status?.isDirty
                              ? 'Commit or stash local changes first'
                              : `Checkout ${rel.tag}`
                        }
                        onClick={() => void runStreamingCoreOp('checkout', rel.tag)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white disabled:opacity-40 border border-slate-700 hover:border-indigo-500 transition-colors"
                      >
                        {isSwitchingThis ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Switching…</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3 h-3" />
                            <span>Switch</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
