'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  Download,
  FileCode2,
  FolderSync,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import type { ModelAsset, ModelCategory, VramEstimationParams } from '@/types';
import { analyzeModelDuplicates, estimateVramRequirements } from '@/lib/model-manager';
import { deduplicateModelsReal, scanModelsReal } from '@/lib/system-client';
import { ModelDownloaderPanel } from './models/ModelDownloaderPanel';
import { ExtraModelPathsPanel } from './models/ExtraModelPathsPanel';
import { DuplicateGroupsPanel, type DuplicateGroup } from './models/DuplicateGroupsPanel';
import { ModelInventoryTable } from './models/ModelInventoryTable';
import { VramEstimatorPanel } from './models/VramEstimatorPanel';

interface ModelsViewProps {
  comfyRoot: string;
  isValidRoot: boolean;
  onRunTerminalCommand?: (cmd: string) => void;
}

export function ModelsView({
  comfyRoot,
  isValidRoot,
  onRunTerminalCommand,
}: ModelsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'storage' | 'vram'>('storage');
  const [models, setModels] = useState<ModelAsset[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ModelCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDownloader, setShowDownloader] = useState(false);
  const [showExtraPaths, setShowExtraPaths] = useState(false);

  const [vramParams, setVramParams] = useState<VramEstimationParams>({
    baseModel: 'Flux.1',
    quantization: 'fp8',
    resolution: '1024x1024',
    batchSize: 1,
    loraCount: 1,
    controlNetCount: 0,
  });

  const refreshModels = useCallback(async () => {
    if (!isValidRoot || !comfyRoot) {
      setModels([]);
      return;
    }
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await scanModelsReal(comfyRoot);
      if (res.error) {
        setScanError(res.error);
      } else {
        setModels(res.models);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan models directory');
    } finally {
      setIsScanning(false);
    }
  }, [comfyRoot, isValidRoot]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshModels();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshModels]);

  const deduplication = useMemo(() => analyzeModelDuplicates(models), [models]);
  const vramResult = useMemo(() => estimateVramRequirements(vramParams), [vramParams]);

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return models.filter((m) => {
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        m.fileName.toLowerCase().includes(q) ||
        m.relativePath.toLowerCase().includes(q) ||
        m.baseModel.toLowerCase().includes(q)
      );
    });
  }, [models, selectedCategory, searchQuery]);

  const handleDeduplicateGroup = async (group: DuplicateGroup) => {
    if (group.assets.length < 2) return;
    const primaryAsset = group.assets[0];
    const duplicateAssets = group.assets.slice(1);

    const res = await deduplicateModelsReal(
      comfyRoot,
      primaryAsset.relativePath,
      duplicateAssets.map((d) => d.relativePath)
    );
    if (!res.success) {
      setScanError(res.error || 'Symlink deduplication failed');
      return;
    }

    await refreshModels();
    onRunTerminalCommand?.(
      `# Reclaimed disk space via OS symlink deduplication for ${primaryAsset.fileName}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-indigo-400" />
              <span>Model Storage &amp; VRAM Studio</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Detect duplicate Checkpoints/LoRAs across folders, create symlinks to reclaim SSD space, download weights, and forecast workflow VRAM requirements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeSubTab === 'storage' && (
              <button
                type="button"
                onClick={() => void refreshModels()}
                disabled={isScanning || !isValidRoot}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning…' : 'Rescan Models'}</span>
              </button>
            )}

            <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveSubTab('storage')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSubTab === 'storage'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FolderSync className="w-3.5 h-3.5" />
                <span>Storage &amp; Deduplicator</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('vram')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSubTab === 'vram'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Pre-flight VRAM Estimator</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 1: Storage & Deduplication */}
      {activeSubTab === 'storage' && (
        <div className="space-y-6">
          {!isValidRoot && (
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 text-xs text-amber-200">
              ComfyUI root directory is not configured or not found on disk. Set a valid ComfyUI path in Settings to scan your <code className="font-mono">models/</code> directory.
            </div>
          )}

          {scanError && (
            <div className="rounded-xl border border-rose-800/60 bg-rose-950/20 p-4 text-xs text-rose-200 font-mono">
              {scanError}
            </div>
          )}

          {/* Storage Action Toolbar */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={!isValidRoot}
              onClick={() => setShowDownloader((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Model</span>
            </button>
            <button
              type="button"
              disabled={!isValidRoot}
              onClick={() => setShowExtraPaths((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>extra_model_paths.yaml</span>
            </button>
          </div>

          {showDownloader && (
            <ModelDownloaderPanel
              comfyRoot={comfyRoot}
              onClose={() => setShowDownloader(false)}
              onDownloaded={refreshModels}
              onError={(msg) => setScanError(msg)}
            />
          )}

          {showExtraPaths && (
            <ExtraModelPathsPanel
              comfyRoot={comfyRoot}
              onClose={() => setShowExtraPaths(false)}
              onSaved={refreshModels}
            />
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Models
              </span>
              <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                {deduplication.totalModelsCount}
              </p>
              <span className="text-[11px] text-slate-500 font-mono">
                checkpoints, loras, vae
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Storage
              </span>
              <p className="text-2xl font-bold text-indigo-400 mt-1 tabular-nums">
                {deduplication.totalStorageGb} <span className="text-sm text-slate-400">GB</span>
              </p>
              <span className="text-[11px] text-slate-500 font-mono">
                Across models/ directory
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Duplicate Groups
              </span>
              <p className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">
                {deduplication.duplicateGroups.length}
              </p>
              <span className="text-[11px] text-amber-500/80 font-mono">
                Identical binary hashes
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Reclaimable Space
              </span>
              <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                {deduplication.potentialSavingsGb}{' '}
                <span className="text-sm text-slate-400">GB</span>
              </p>
              <span className="text-[11px] text-emerald-500/80 font-mono">
                Via symlink replacement
              </span>
            </div>
          </div>

          <DuplicateGroupsPanel
            duplicateGroups={deduplication.duplicateGroups}
            potentialSavingsGb={deduplication.potentialSavingsGb}
            onDeduplicateGroup={handleDeduplicateGroup}
          />

          <ModelInventoryTable
            models={filteredModels}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isScanning={isScanning}
          />
        </div>
      )}

      {/* Tab 2: Pre-flight VRAM Estimator */}
      {activeSubTab === 'vram' && (
        <VramEstimatorPanel
          params={vramParams}
          result={vramResult}
          onChange={setVramParams}
        />
      )}
    </div>
  );
}
