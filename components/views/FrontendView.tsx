'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutGrid,
  RefreshCw,
  Download,
  RotateCcw,
  CheckCircle2,
  Search,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { compareSemverDesc, type FrontendReleaseItem } from '@/lib/frontend-versions';
import type { TerminalLogEntry } from '@/types';

interface FrontendViewProps {
  comfyRoot: string;
  pythonBinary: string;
  isValidRoot: boolean;
  onAddLog?: (entry: Omit<TerminalLogEntry, 'id'>) => void;
  onNotify?: (tone: 'info' | 'success' | 'warn' | 'error', title: string, detail?: string) => void;
  onNavigateToSettings?: () => void;
}

export function FrontendView({
  comfyRoot,
  pythonBinary,
  isValidRoot,
  onAddLog,
  onNotify,
  onNavigateToSettings,
}: FrontendViewProps) {
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releases, setReleases] = useState<FrontendReleaseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [installingVersion, setInstallingVersion] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchFrontendReleasesData = useCallback(async () => {
    const res = await fetch('/api/env/frontend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list',
        comfyRoot,
        pythonBinary: pythonBinary || 'python',
      }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  }, [comfyRoot, pythonBinary]);

  const loadFrontendReleases = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { ok, data } = await fetchFrontendReleasesData();
      if (!ok) {
        setErrorMsg(data.error || 'Failed to fetch frontend releases.');
      }
      setInstalledVersion(data.installedVersion ?? null);
      setLatestVersion(data.latestVersion ?? null);
      setReleases(Array.isArray(data.releases) ? data.releases : []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load frontend versions.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchFrontendReleasesData]);

  useEffect(() => {
    let cancelled = false;
    void fetchFrontendReleasesData()
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setErrorMsg(data.error || 'Failed to fetch frontend releases.');
        }
        setInstalledVersion(data.installedVersion ?? null);
        setLatestVersion(data.latestVersion ?? null);
        setReleases(Array.isArray(data.releases) ? data.releases : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load frontend versions.');
      });
    return () => {
      cancelled = true;
    };
  }, [fetchFrontendReleasesData]);

  const handleInstallVersion = async (targetVersion: string) => {
    if (!isValidRoot) {
      onNavigateToSettings?.();
      return;
    }

    setInstallingVersion(targetVersion);
    setErrorMsg(null);
    setStatusMsg(null);

    onAddLog?.({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[Frontend] Installing comfyui-frontend-package==${targetVersion}...`,
    });

    try {
      const res = await fetch('/api/env/frontend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'install',
          comfyRoot,
          pythonBinary: pythonBinary || 'python',
          version: targetVersion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || `Failed to install v${targetVersion}`;
        setErrorMsg(msg);
        onAddLog?.({
          timestamp: new Date().toLocaleTimeString(),
          type: 'stderr',
          text: `[Frontend Error] ${msg}`,
        });
        onNotify?.('error', 'Frontend Install Failed', msg);
        return;
      }

      const prev = data.previousVersion || installedVersion;
      const next = data.installedVersion || targetVersion;
      setInstalledVersion(next);
      const summary = prev
        ? `Switched comfyui-frontend-package from v${prev} to v${next}. Restart ComfyUI if running.`
        : `Installed comfyui-frontend-package v${next}. Restart ComfyUI if running.`;
      setStatusMsg(summary);
      onAddLog?.({
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
        text: `[Frontend] ${summary}`,
      });
      onNotify?.('success', `Frontend v${next} Installed`, 'Restart ComfyUI to apply.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Frontend installation failed.';
      setErrorMsg(msg);
      onNotify?.('error', 'Frontend Install Failed', msg);
    } finally {
      setInstallingVersion(null);
    }
  };

  const hasUpdate = Boolean(
    installedVersion && latestVersion && compareSemverDesc(installedVersion, latestVersion) > 0
  );

  const filteredReleases = releases.filter((r) =>
    !searchQuery.trim() ? true : r.version.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>PyPI Package</span>
              <span aria-hidden="true">·</span>
              <code className="font-mono text-indigo-300">comfyui-frontend-package</code>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              ComfyUI Frontend Versions
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Inspect your installed ComfyUI web UI version, upgrade to the latest release, or roll back to an earlier release in one click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="https://github.com/Comfy-Org/ComfyUI_frontend/releases"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Release Notes</span>
            </a>
            <button
              type="button"
              disabled={isLoading || installingVersion !== null}
              onClick={() => void loadFrontendReleases()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {hasUpdate && latestVersion && (
              <button
                type="button"
                disabled={installingVersion !== null}
                onClick={() => void handleInstallVersion(latestVersion)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Update to v{latestVersion}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] text-slate-400">Installed Version</div>
          <div className="text-lg font-bold font-mono tabular-nums text-white mt-1">
            {installedVersion ? `v${installedVersion}` : isValidRoot ? 'Not Detected' : 'No Root Set'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] text-slate-400">Latest PyPI Release</div>
          <div className="text-lg font-bold font-mono tabular-nums text-indigo-300 mt-1">
            {latestVersion ? `v${latestVersion}` : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] text-slate-400">Status</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-mono font-semibold">
            {hasUpdate ? (
              <span className="text-amber-300">Update available</span>
            ) : installedVersion ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Up to date</span>
              </span>
            ) : (
              <span className="text-slate-400">Select a version below to install</span>
            )}
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 text-xs text-emerald-200 font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200 font-mono">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search + Releases Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <LayoutGrid className="w-4 h-4 text-indigo-400" />
            <span>Released Versions ({filteredReleases.length})</span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter version (e.g. 1.14)…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              <tr>
                <th className="py-2.5 px-4">Version</th>
                <th className="py-2.5 px-4">Release Date</th>
                <th className="py-2.5 px-4">State</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
              {filteredReleases.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    {isLoading ? 'Loading releases from PyPI…' : 'No matching frontend releases found.'}
                  </td>
                </tr>
              ) : (
                filteredReleases.map((rel) => {
                  const isInstalled = installedVersion === rel.version;
                  const isLatest = latestVersion === rel.version;
                  const isOlderThanInstalled =
                    installedVersion !== null && compareSemverDesc(rel.version, installedVersion) > 0;
                  const isBusy = installingVersion === rel.version;

                  return (
                    <tr
                      key={rel.version}
                      className={isInstalled ? 'bg-emerald-950/15' : 'hover:bg-slate-900/50'}
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-100">
                        v{rel.version}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {rel.releasedAt
                          ? new Date(rel.releasedAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {isInstalled && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300">
                              Installed
                            </span>
                          )}
                          {isLatest && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] text-indigo-300">
                              Latest
                            </span>
                          )}
                          {!isInstalled && !isLatest && (
                            <span className="text-[11px] text-slate-500">
                              {isOlderThanInstalled ? 'Previous release' : 'Newer release'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {isInstalled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={installingVersion !== null}
                            onClick={() => void handleInstallVersion(rel.version)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                              isOlderThanInstalled
                                ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 border border-amber-500/40'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            {isBusy ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Installing…</span>
                              </>
                            ) : isOlderThanInstalled ? (
                              <>
                                <RotateCcw className="w-3 h-3" />
                                <span>Rollback</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                <span>Install</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
