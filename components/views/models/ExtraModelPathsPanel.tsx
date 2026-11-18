'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ExtraModelPathsPanelProps {
  comfyRoot: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function ExtraModelPathsPanel({
  comfyRoot,
  onClose,
  onSaved,
}: ExtraModelPathsPanelProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!comfyRoot) return;
    let cancelled = false;
    void fetch('/api/environment/extra-paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read', comfyRoot }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && typeof data.content === 'string') {
          setContent(data.content);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage({ ok: false, text: 'Failed to load extra_model_paths.yaml' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [comfyRoot]);

  const handleSave = async () => {
    if (!comfyRoot) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/environment/extra-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', comfyRoot, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          ok: false,
          text: data.error || 'Failed to save extra_model_paths.yaml',
        });
        return;
      }
      setMessage({
        ok: true,
        text: `Saved extra_model_paths.yaml (${data.parsedCount ?? 0} path entries).`,
      });
      await onSaved();
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to save extra_model_paths.yaml',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white">
          extra_model_paths.yaml (Shared Model Directories)
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white"
          aria-label="Close extra model paths editor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <textarea
        rows={7}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-mono ${
            message?.ok === false ? 'text-rose-300' : 'text-emerald-300'
          }`}
        >
          {message?.text || 'Changes take effect immediately in Models & VRAM scans.'}
        </span>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSave()}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
        >
          {isSaving ? 'Saving…' : 'Save & Rescan'}
        </button>
      </div>
    </div>
  );
}
