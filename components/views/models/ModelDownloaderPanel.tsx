'use client';

import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ModelDownloaderPanelProps {
  comfyRoot: string;
  onClose: () => void;
  onDownloaded: () => Promise<void> | void;
  onError: (message: string) => void;
}

interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number;
  percent: number | null;
}

export function ModelDownloaderPanel({
  comfyRoot,
  onClose,
  onDownloaded,
  onError,
}: ModelDownloaderPanelProps) {
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadCategory, setDownloadCategory] = useState('checkpoints');
  const [downloadFileName, setDownloadFileName] = useState('');
  const [downloadToken, setDownloadToken] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);

  const handleStartDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comfyRoot || !downloadUrl.trim() || isDownloading) return;

    const controller = new AbortController();
    downloadAbortRef.current = controller;
    setIsDownloading(true);
    setDownloadProgress(null);
    setDownloadMessage(null);

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
        onError(errData.error || `Download failed (HTTP ${res.status})`);
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
            await onDownloaded();
          } else if (evt.type === 'error') {
            onError(evt.error || 'Model download failed');
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        onError(err instanceof Error ? err.message : 'Download failed');
      }
    } finally {
      downloadAbortRef.current = null;
      setIsDownloading(false);
    }
  };

  return (
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
          onClick={onClose}
          className="text-slate-400 hover:text-white"
          aria-label="Close downloader"
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
  );
}
