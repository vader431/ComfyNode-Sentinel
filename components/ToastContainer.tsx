'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, Terminal } from 'lucide-react';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'info' | 'warn' | 'error';
  title: string;
  detail?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  onOpenConsole?: () => void;
}

export function ToastContainer({
  toasts,
  onDismiss,
  onOpenConsole,
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => {
        const toneStyles =
          t.tone === 'success'
            ? 'border-emerald-700/70 bg-slate-900/95 text-emerald-200'
            : t.tone === 'warn'
            ? 'border-amber-700/70 bg-slate-900/95 text-amber-200'
            : t.tone === 'error'
            ? 'border-rose-700/70 bg-slate-900/95 text-rose-200'
            : 'border-indigo-700/70 bg-slate-900/95 text-slate-200';

        const Icon =
          t.tone === 'success'
            ? CheckCircle2
            : t.tone === 'warn'
            ? AlertTriangle
            : t.tone === 'error'
            ? XCircle
            : Info;

        const iconColor =
          t.tone === 'success'
            ? 'text-emerald-400'
            : t.tone === 'warn'
            ? 'text-amber-400'
            : t.tone === 'error'
            ? 'text-rose-400'
            : 'text-indigo-400';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border p-3 shadow-xl backdrop-blur-md flex items-start gap-2.5 ${toneStyles}`}
          >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{t.title}</div>
              {t.detail && (
                <div className="text-[11px] opacity-80 mt-0.5 line-clamp-2 font-mono">
                  {t.detail}
                </div>
              )}
              {onOpenConsole && (
                <button
                  onClick={onOpenConsole}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-mono text-indigo-300 hover:text-indigo-200"
                >
                  <Terminal className="w-3 h-3" />
                  <span>View in Console</span>
                </button>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="p-0.5 rounded opacity-60 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

