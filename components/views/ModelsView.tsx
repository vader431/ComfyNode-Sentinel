'use client';

import React, { useState } from 'react';
import {
  HardDrive,
  Cpu,
  Copy,
  Check,
  AlertTriangle,
  FolderSync,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  ModelAsset,
  ModelCategory,
  BaseModelFamily,
  VramEstimationParams,
} from '../../types';
import {
  analyzeModelDuplicates,
  estimateVramRequirements,
  generateSymlinkScript,
  INITIAL_MODEL_ASSETS,
} from '../../lib/model-manager';

interface ModelsViewProps {
  onRunTerminalCommand?: (cmd: string) => void;
}

export function ModelsView({ onRunTerminalCommand }: ModelsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'storage' | 'vram'>('storage');
  const [models, setModels] = useState<ModelAsset[]>(INITIAL_MODEL_ASSETS);
  const [selectedCategory, setSelectedCategory] = useState<ModelCategory | 'all'>('all');
  const [copiedGroupHash, setCopiedGroupHash] = useState<string | null>(null);

  // VRAM Estimator state
  const [vramParams, setVramParams] = useState<VramEstimationParams>({
    baseModel: 'Flux.1',
    quantization: 'fp8',
    resolution: '1024x1024',
    batchSize: 1,
    loraCount: 1,
    controlNetCount: 0,
  });

  const deduplication = analyzeModelDuplicates(models);
  const vramResult = estimateVramRequirements(vramParams);

  const filteredModels = models.filter((m) =>
    selectedCategory === 'all' ? true : m.category === selectedCategory
  );

  const handleCopySymlinkScript = (
    group: (typeof deduplication.duplicateGroups)[0],
    isWindows: boolean
  ) => {
    const script = generateSymlinkScript(group, isWindows);
    navigator.clipboard.writeText(script);
    setCopiedGroupHash(group.hash);
    setTimeout(() => setCopiedGroupHash(null), 2000);
  };

  const handleDeduplicateAsset = (groupHash: string) => {
    // Keep the primary asset, mark secondary as symlink
    setModels((prev) => {
      let seenPrimary = false;
      return prev.map((m) => {
        if (m.hash === groupHash) {
          if (!seenPrimary) {
            seenPrimary = true;
            return { ...m, isDuplicate: false };
          }
          return {
            ...m,
            isDuplicate: false,
            isSymlink: true,
            sizeGb: 0.001, // Reclaimed
            symlinkTarget: `models/checkpoints/${m.fileName}`,
          };
        }
        return m;
      });
    });

    if (onRunTerminalCommand) {
      onRunTerminalCommand(
        `# Reclaimed disk space via symlink deduplication for group ${groupHash}`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Subnav Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-400" />
            <span>Model Storage & VRAM Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Detect duplicate Checkpoints/LoRAs across folders, create symlinks to reclaim SSD space, and forecast workflow VRAM requirements before generation.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('storage')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === 'storage'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Storage & Deduplicator</span>
          </button>
          <button
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

      {/* Tab 1: Storage & Deduplication */}
      {activeSubTab === 'storage' && (
        <div className="space-y-6">
          {/* Metrics summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Models
              </span>
              <p className="text-2xl font-bold text-white mt-1">
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
              <p className="text-2xl font-bold text-indigo-400 mt-1">
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
              <p className="text-2xl font-bold text-amber-400 mt-1">
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
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {deduplication.potentialSavingsGb} <span className="text-sm text-slate-400">GB</span>
              </p>
              <span className="text-[11px] text-emerald-500/80 font-mono">
                Via symlink replacement
              </span>
            </div>
          </div>

          {/* Duplicate Groups Alert & Actions */}
          {deduplication.duplicateGroups.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Duplicate Models Detected ({deduplication.duplicateGroups.length} Groups)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Identical weights are consuming {deduplication.potentialSavingsGb} GB of redundant SSD storage. Replace redundant copies with OS symlinks.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {deduplication.duplicateGroups.map((group) => (
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
                          onClick={() => handleCopySymlinkScript(group, true)}
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
                          onClick={() => handleDeduplicateAsset(group.hash)}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 rounded-md border border-emerald-800/60 transition-colors"
                        >
                          <FolderSync className="w-3.5 h-3.5" />
                          <span>Deduplicate in Sentinel</span>
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
                            {idx === 0 ? '📌 Primary: ' : '📄 Duplicate: '}
                            {asset.relativePath}
                          </span>
                          <span className="text-[11px] text-slate-500 shrink-0">
                            {asset.sizeGb} GB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model Asset Inventory Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Scanned Model Files
                </span>
                <span className="text-xs font-mono text-slate-500">
                  ({filteredModels.length} files)
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(['all', 'checkpoints', 'loras', 'controlnet', 'vae'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors uppercase tracking-wider ${
                      selectedCategory === cat
                        ? 'bg-slate-800 text-indigo-400 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">File & Relative Path</th>
                    <th className="py-2.5 px-4 font-semibold">Category</th>
                    <th className="py-2.5 px-4 font-semibold">Base Model</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Size</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredModels.map((model) => (
                    <tr key={model.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-200">{model.fileName}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-md">
                          {model.relativePath}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                          {model.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-slate-300 font-semibold">{model.baseModel}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-200 font-bold">
                        {model.sizeGb} GB
                      </td>
                      <td className="py-2.5 px-4">
                        {model.isSymlink ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            🔗 Symlink
                          </span>
                        ) : model.isDuplicate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            ⚠ Duplicate
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            ✓ Unique
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Pre-flight VRAM Estimator */}
      {activeSubTab === 'vram' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Parameters */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  Workflow Configuration Parameters
                </h3>
              </div>

              {/* Base Model Family */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Target Diffusion Architecture
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Flux.1', 'SDXL', 'SD1.5', 'SD3', 'HunyuanVideo'] as BaseModelFamily[]).map(
                    (model) => (
                      <button
                        key={model}
                        onClick={() => setVramParams({ ...vramParams, baseModel: model })}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                          vramParams.baseModel === model
                            ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                            : 'bg-slate-800/40 border-slate-700/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        {model}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Quantization */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Precision / Quantization Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'fp16', label: 'FP16 / BF16', sub: 'Native Uncompressed' },
                    { id: 'fp8', label: 'FP8 (e4m3fn)', sub: 'Fast 50% Reduction' },
                    { id: 'q4', label: 'GGUF Q4', sub: 'Maximum Compression' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() =>
                        setVramParams({
                          ...vramParams,
                          quantization: item.id as VramEstimationParams['quantization'],
                        })
                      }
                      className={`p-2.5 text-xs rounded-lg border text-left transition-colors ${
                        vramParams.quantization === item.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                          : 'bg-slate-800/40 border-slate-700/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-mono">{item.label}</div>
                      <div className="text-[10px] text-slate-500">{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Preset */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Target Generation Resolution
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['512x512', '768x768', '1024x1024', '1920x1080'] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setVramParams({ ...vramParams, resolution: res })}
                      className={`px-3 py-2 text-xs font-mono rounded-lg border text-center transition-colors ${
                        vramParams.resolution === res
                          ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                          : 'bg-slate-800/40 border-slate-700/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batch Size & Adapters sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1 font-mono">
                    <span className="text-slate-400">Batch Size:</span>
                    <span className="text-indigo-400 font-bold">{vramParams.batchSize}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={vramParams.batchSize}
                    onChange={(e) =>
                      setVramParams({ ...vramParams, batchSize: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1 font-mono">
                    <span className="text-slate-400">Active LoRAs:</span>
                    <span className="text-indigo-400 font-bold">{vramParams.loraCount}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    value={vramParams.loraCount}
                    onChange={(e) =>
                      setVramParams({ ...vramParams, loraCount: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1 font-mono">
                    <span className="text-slate-400">ControlNets:</span>
                    <span className="text-indigo-400 font-bold">{vramParams.controlNetCount}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    value={vramParams.controlNetCount}
                    onChange={(e) =>
                      setVramParams({ ...vramParams, controlNetCount: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Telemetry & Gauge */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Estimated Peak VRAM Consumption
                </span>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {vramResult.totalPeakVramGb} GB
                </span>
              </div>

              {/* Progress gauge bar */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1">
                  <span>0 GB</span>
                  <span className={vramResult.fitsIn8Gb ? 'text-emerald-400' : 'text-slate-600'}>
                    8 GB
                  </span>
                  <span className={vramResult.fitsIn12Gb ? 'text-emerald-400' : 'text-slate-600'}>
                    12 GB
                  </span>
                  <span className={vramResult.fitsIn16Gb ? 'text-emerald-400' : 'text-slate-600'}>
                    16 GB
                  </span>
                  <span className={vramResult.fitsIn24Gb ? 'text-emerald-400' : 'text-slate-600'}>
                    24 GB
                  </span>
                  <span className="text-rose-400">&gt;24 GB</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${Math.min(100, (vramResult.totalPeakVramGb / 32) * 100)}%`,
                    }}
                    className={`h-full transition-all duration-300 rounded-full ${
                      vramResult.totalPeakVramGb <= 11.8
                        ? 'bg-emerald-500'
                        : vramResult.totalPeakVramGb <= 15.8
                        ? 'bg-indigo-500'
                        : vramResult.totalPeakVramGb <= 23.8
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                </div>
              </div>

              {/* Target GPU Tier */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/40">
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Recommended Hardware Tier
                </span>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>{vramResult.tierRecommendation}</span>
                </div>
              </div>

              {/* Memory Breakdown Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                  <span className="text-slate-500 block text-[11px]">Base Weights:</span>
                  <span className="text-white font-bold text-sm">
                    {vramResult.baseWeightsVramGb} GB
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                  <span className="text-slate-500 block text-[11px]">Latent Activations:</span>
                  <span className="text-white font-bold text-sm">
                    {vramResult.activationsVramGb} GB
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                  <span className="text-slate-500 block text-[11px]">LoRA Adapters:</span>
                  <span className="text-white font-bold text-sm">
                    {vramResult.loraVramGb} GB
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                  <span className="text-slate-500 block text-[11px]">ControlNet Weights:</span>
                  <span className="text-white font-bold text-sm">
                    {vramResult.controlNetVramGb} GB
                  </span>
                </div>
              </div>

              {/* Warnings and Architectural Alerts */}
              {vramResult.warnings.length > 0 && (
                <div className="space-y-2">
                  {vramResult.warnings.map((warn, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 flex items-start gap-2"
                    >
                      <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

