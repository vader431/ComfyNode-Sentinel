'use client';

import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, FolderSync, Loader2 } from 'lucide-react';
import type { ModelAsset } from '@/types';
import { generateSymlinkScript } from '@/lib/model-manager';

export interface DuplicateGroup {
  hash: string;
  fileName: string;
  sizeGb: number;
  assets: ModelAsset[];
}

interface DuplicateGroupsPanelProps {
  duplicateGroups: DuplicateGroup[];
  potentialSavingsGb: number;
  onDeduplicateGroup: (group: DuplicateGroup) => Promise<void>;
}

export function DuplicateGroupsPanel({
  duplicateGroups,
  potentialSavingsGb,
  onDeduplicateGroup,
}: DuplicateGroupsPanelProps) {
  const [copiedGroupHash, setCopiedGroupHash] = useState<string | null>(null);
  const [deduplicatingHash, setDeduplicatingHash] = useState<string | null>(null);

  if (duplicateGroups.length === 0) return null;

  const handleCopySymlinkScript = (group: DuplicateGroup) => {
    const script = generateSymlinkScript(group, true);
    navigator.clipboard.writeText(script);
    setCopiedGroupHash(group.hash);
    setTimeout(() => setCopiedGroupHash(null), 2000);
  };

  const handleDeduplicate = async (group: DuplicateGroup) => {
    setDeduplicatingHash(group.hash);
    try {
      await onDeduplicateGroup(group);
    } finally {
      setDeduplicatingHash(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            Duplicate Models Detected ({duplicateGroups.length} Groups)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Identical weights are consuming {potentialSavingsGb} GB of redundant SSD storage. Replace redundant copies with OS symlinks.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {duplicateGroups.map((group) => {
          const isBusy = deduplicatingHash === group.hash;
          return (
            <div
              key={group.hash}
              className="p-4 rounded-lg border border-slate-800 bg-slate-900/90 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white">
                    {group.fileName}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {group.sizeGb} GB each ({group.assets.length} copies)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopySymlinkScript(group)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
                    title="Copy PowerShell script to replace duplicate with symlink"
                  >
                    {copiedGroupHash === group.hash ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copy PowerShell Symlink</span>
                  </button>
                  <button
                    type="button"
                    disabled={deduplicatingHash !== null}
                    onClick={() => void handleDeduplicate(group)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 disabled:opacity-50 rounded-md border border-emerald-800/60 transition-colors"
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FolderSync className="w-3.5 h-3.5" />
                    )}
                    <span>{isBusy ? 'Deduplicating…' : 'Deduplicate in Sentinel'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {group.assets.map((asset, idx) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between text-xs font-mono text-slate-400 bg-black/40 px-3 py-1.5 rounded border border-slate-800/80"
                  >
                    <span className="truncate max-w-xl">
                      {idx === 0 ? 'Primary: ' : 'Duplicate: '}
                      {asset.relativePath}
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">
                      {asset.sizeGb} GB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
