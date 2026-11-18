'use client';

import React from 'react';
import { Search } from 'lucide-react';
import type { ModelAsset, ModelCategory } from '@/types';

const CATEGORIES: Array<ModelCategory | 'all'> = [
  'all',
  'checkpoints',
  'loras',
  'controlnet',
  'vae',
  'upscale_models',
];

interface ModelInventoryTableProps {
  models: ModelAsset[];
  selectedCategory: ModelCategory | 'all';
  onSelectCategory: (cat: ModelCategory | 'all') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isScanning: boolean;
}

export function ModelInventoryTable({
  models,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  isScanning,
}: ModelInventoryTableProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-slate-800">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Scanned Model Files
            </span>
            <span className="text-xs font-mono text-slate-500">
              ({models.length} files)
            </span>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter models or paths..."
              className="w-full pl-8 pr-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
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
              <th className="py-2.5 px-4 font-semibold">File &amp; Relative Path</th>
              <th className="py-2.5 px-4 font-semibold">Category</th>
              <th className="py-2.5 px-4 font-semibold">Base Model</th>
              <th className="py-2.5 px-4 font-semibold text-right">Size</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {models.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-xs text-slate-500 font-sans">
                  {isScanning
                    ? 'Scanning models directory…'
                    : 'No matching model files found.'}
                </td>
              </tr>
            ) : (
              models.map((model) => (
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
                  <td className="py-2.5 px-4 text-right text-slate-200 font-bold tabular-nums">
                    {model.sizeGb} GB
                  </td>
                  <td className="py-2.5 px-4">
                    {model.isSymlink ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        Symlink
                      </span>
                    ) : model.isDuplicate ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Duplicate
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Unique
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
