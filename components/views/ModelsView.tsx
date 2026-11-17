'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Cpu,
  Copy,
  Check,
  AlertTriangle,
  FolderSync,
  Sparkles,
  Info,
  RefreshCw,
  Download,
  FileCode2,
  X,
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
} from '../../lib/model-manager';
import { scanModelsReal, deduplicateModelsReal } from '../../lib/system-client';

interface ModelsViewProps {
  comfyRoot: string;
  isValidRoot: boolean;
  onRunTerminalCommand?: (cmd: string) => void;
}

export function ModelsView({ comfyRoot, isValidRoot, onRunTerminalCommand }: ModelsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'storage' | 'vram'>('storage');
  const [models, setModels] = useState<ModelAsset[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ModelCategory | 'all'>('all');
  const [copiedGroupHash, setCopiedGroupHash] = useState<string | null>(null);

  // Direct Model Downloader state
  const [showDownloader, setShowDownloader] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadCategory, setDownloadCategory] = useState<string>('checkpoints');
  const [downloadFileName, setDownloadFileName] = useState('');
  const [downloadToken, setDownloadToken] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    receivedBytes: number;
    totalBytes: number;
    percent: number | null;
  } | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const downloadAbortRef = React.useRef<AbortController | null>(null);

  // extra_model_paths.yaml editor state
  const [showExtraPaths, setShowExtraPaths] = useState(false);
  const [extraYamlContent, setExtraYamlContent] = useState('');
  const [isSavingExtraYaml, setIsSavingExtraYaml] = useState(false);
  const [extraYamlMessage, setExtraYamlMessage] = useState<string | null>(null);

  // VRAM Estimator state
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

  const handleDeduplicateAsset = async (groupHash: string) => {
    const group = deduplication.duplicateGroups.find((g) => g.hash === groupHash);
    if (!group || group.assets.length < 2) return;

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
    if (onRunTerminalCommand) {
      onRunTerminalCommand(
        `# Reclaimed disk space via OS symlink deduplication for ${primaryAsset.fileName}`
      );
    }
  };

  const handleOpenExtraPaths = async () => {
    const nextOpen = !showExtraPaths;
    setShowExtraPaths(nextOpen);
    if (!nextOpen || !comfyRoot) return;
    setExtraYamlMessage(null);
    try {
      const res = await fetch('/api/environment/extra-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', comfyRoot }),
      });
      const data = await res.json();
      if (typeof data.content === 'string') setExtraYamlContent(data.content);
    } catch {
      setExtraYamlMessage('Failed to load extra_model_paths.yaml');
    }
  };

  const handleSaveExtraPaths = async () => {
    if (!comfyRoot) return;
    setIsSavingExtraYaml(true);
    setExtraYamlMessage(null);
    try {
      const res = await fetch('/api/environment/extra-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', comfyRoot, content: extraYamlContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExtraYamlMessage(data.error || 'Failed to save extra_model_paths.yaml');
        return;
      }
      setExtraYamlMessage(`Saved extra_model_paths.yaml (${data.parsedCount ?? 0} path entries).`);
      await refreshModels();
    } finally {
      setIsSavingExtraYaml(false);
    }
  };

  const handleStartDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comfyRoot || !downloadUrl.trim() || isDownloading) return;
    const controller = new AbortController();
    downloadAbortRef.current = controller;
    setIsDownloading(true);
    setDownloadProgress(null);
    setDownloadMessage(null);
    setScanError(null);

    try {
      const res = await fetch('/api/models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comfyRoot,
          modelType: downloadCategory,
          url: downloadUrl.trim(),
          fileName: downloadFileName.trim() || undefined,
          authToken: downloadToken.trim() || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setScanError(errData.error || `Download failed (HTTP ${res.status})`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            receivedBytes?: number;
            totalBytes?: number;
            percent?: number | null;
            fileName?: string;
            error?: string;
          };
          if (evt.type === 'progress') {
            setDownloadProgress({
              receivedBytes: evt.receivedBytes ?? 0,
              totalBytes: evt.totalBytes ?? 0,
              percent: evt.percent ?? null,
            });
          } else if (evt.type === 'done') {
            setDownloadMessage(`Downloaded ${evt.fileName} into models/${downloadCategory}/`);
            setDownloadUrl('');
            setDownloadFileName('');
            await refreshModels();
          } else if (evt.type === 'error') {
            setScanError(evt.error || 'Model download failed');
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setScanError(err instanceof Error ? err.message : 'Download failed');
      }
    } finally {
      downloadAbortRef.current = null;
      setIsDownloading(false);
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

        <div className="flex items-center gap-2">
          {activeSubTab === 'storage' && (
            <button
              onClick={refreshModels}
              disabled={isScanning || !isValidRoot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Rescan Models'}</span>
            </button>
          )}
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
          {/* Metrics summary */}
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
              onClick={() => void handleOpenExtraPaths()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>extra_model_paths.yaml</span>
            </button>
          </div>

          {showDownloader && (
            <form
              onSubmit={handleStartDownload}
              className="rounded-xl border border-indigo-500/40 bg-slate-900/70 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">
                  Direct Model Downloader (HuggingFace / Civitai / Direct URL)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDownloader(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <input
                  type="url"
                  required
                  value={downloadUrl}
                  onChange={(e) => setDownloadUrl(e.target.value)}
                  placeholder="https://huggingface.co/.../model.safetensors"
                  className="md:col-span-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={downloadCategory}
                  onChange={(e) => setDownloadCategory(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="checkpoints">models/checkpoints</option>
                  <option value="loras">models/loras</option>
                  <option value="controlnet">models/controlnet</option>
                  <option value="vae">models/vae</option>
                  <option value="upscale_models">models/upscale_models</option>
                  <option value="unet">models/unet</option>
                  <option value="clip">models/clip</option>
                </select>
                <input
                  type="text"
                  value={downloadFileName}
                  onChange={(e) => setDownloadFileName(e.target.value)}
                  placeholder="Optional filename.safetensors"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="password"
                  value={downloadToken}
                  onChange={(e) => setDownloadToken(e.target.value)}
                  placeholder="Optional Bearer token (for gated HuggingFace / Civitai models)"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                {isDownloading ? (
                  <button
                    type="button"
                    onClick={() => downloadAbortRef.current?.abort()}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
                  >
                    Cancel Download
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!downloadUrl.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
                  >
                    Start Download
                  </button>
                )}
              </div>
              {downloadProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-300 tabular-nums">
                    <span>
                      {(downloadProgress.receivedBytes / (1024 * 1024)).toFixed(1)} MB
                      {downloadProgress.totalBytes > 0
                        ? ` / ${(downloadProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB`
                        : ''}
                    </span>
                    <span>
                      {downloadProgress.percent !== null ? `${downloadProgress.percent}%` : 'Streaming…'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    {downloadProgress.percent !== null ? (
                      <div
                        className="h-full bg-indigo-500 transition-all duration-150"
                        style={{ width: `${downloadProgress.percent}%` }}
                      />
                    ) : (
                      <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-500 animate-pulse" />
                    )}
                  </div>
                </div>
              )}
              {downloadMessage && (
                <div className="text-xs font-mono text-emerald-300">{downloadMessage}</div>
              )}
            </form>
          )}

          {showExtraPaths && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">
                  extra_model_paths.yaml (Shared Model Directories)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExtraPaths(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={7}
                value={extraYamlContent}
                onChange={(e) => setExtraYamlContent(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-emerald-300">
                  {extraYamlMessage || 'Changes take effect immediately in Models & VRAM scans.'}
                </span>
                <button
                  type="button"
                  disabled={isSavingExtraYaml}
                  onClick={() => void handleSaveExtraPaths()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
                >
                  {isSavingExtraYaml ? 'Saving…' : 'Save & Rescan'}
                </button>
              </div>
            </div>
          )}

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
                {(['all', 'checkpoints', 'loras', 'controlnet', 'vae', 'upscale_models'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors uppercase tracking-wider shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-slate-800 text-indigo-400 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat === 'upscale_models' ? 'upscalers' : cat}
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
                <div className="grid grid-cols-3 gap-2">
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

