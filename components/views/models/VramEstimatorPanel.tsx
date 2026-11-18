'use client';

import React from 'react';
import { Cpu, Info, Sparkles } from 'lucide-react';
import type { BaseModelFamily, VramEstimationParams } from '@/types';
import type { estimateVramRequirements } from '@/lib/model-manager';

type VramEstimationResult = ReturnType<typeof estimateVramRequirements>;

const BASE_MODELS: BaseModelFamily[] = ['Flux.1', 'SDXL', 'SD1.5', 'SD3', 'HunyuanVideo'];
const QUANTIZATIONS: Array<{
  id: VramEstimationParams['quantization'];
  label: string;
  sub: string;
}> = [
  { id: 'fp16', label: 'FP16 / BF16', sub: 'Native Uncompressed' },
  { id: 'fp8', label: 'FP8 (e4m3fn)', sub: 'Fast 50% Reduction' },
  { id: 'q4', label: 'GGUF Q4', sub: 'Maximum Compression' },
];
const RESOLUTIONS: VramEstimationParams['resolution'][] = [
  '512x512',
  '768x768',
  '1024x1024',
  '1920x1080',
];

interface VramEstimatorPanelProps {
  params: VramEstimationParams;
  result: VramEstimationResult;
  onChange: (next: VramEstimationParams) => void;
}

export function VramEstimatorPanel({ params, result, onChange }: VramEstimatorPanelProps) {
  return (
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
              {BASE_MODELS.map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => onChange({ ...params, baseModel: model })}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                    params.baseModel === model
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                      : 'bg-slate-800/40 border-slate-700/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          </div>

          {/* Quantization */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Precision / Quantization Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {QUANTIZATIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChange({ ...params, quantization: item.id })}
                  className={`p-2.5 text-xs rounded-lg border text-left transition-colors ${
                    params.quantization === item.id
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
              {RESOLUTIONS.map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => onChange({ ...params, resolution: res })}
                  className={`px-3 py-2 text-xs font-mono rounded-lg border text-center transition-colors ${
                    params.resolution === res
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
                <span className="text-indigo-400 font-bold">{params.batchSize}</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                value={params.batchSize}
                onChange={(e) => onChange({ ...params, batchSize: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-slate-400">Active LoRAs:</span>
                <span className="text-indigo-400 font-bold">{params.loraCount}</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                value={params.loraCount}
                onChange={(e) => onChange({ ...params, loraCount: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-slate-400">ControlNets:</span>
                <span className="text-indigo-400 font-bold">{params.controlNetCount}</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                value={params.controlNetCount}
                onChange={(e) =>
                  onChange({ ...params, controlNetCount: Number(e.target.value) })
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
            <span className="text-xs font-mono font-bold text-indigo-400 tabular-nums">
              {result.totalPeakVramGb} GB
            </span>
          </div>

          {/* Progress gauge bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1">
              <span>0 GB</span>
              <span className={result.fitsIn8Gb ? 'text-emerald-400' : 'text-slate-600'}>
                8 GB
              </span>
              <span className={result.fitsIn12Gb ? 'text-emerald-400' : 'text-slate-600'}>
                12 GB
              </span>
              <span className={result.fitsIn16Gb ? 'text-emerald-400' : 'text-slate-600'}>
                16 GB
              </span>
              <span className={result.fitsIn24Gb ? 'text-emerald-400' : 'text-slate-600'}>
                24 GB
              </span>
              <span className="text-rose-400">&gt;24 GB</span>
            </div>
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${Math.min(100, (result.totalPeakVramGb / 32) * 100)}%`,
                }}
                className={`h-full transition-all duration-300 rounded-full ${
                  result.totalPeakVramGb <= 11.8
                    ? 'bg-emerald-500'
                    : result.totalPeakVramGb <= 15.8
                      ? 'bg-indigo-500'
                      : result.totalPeakVramGb <= 23.8
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
              <span>{result.tierRecommendation}</span>
            </div>
          </div>

          {/* Memory Breakdown Cards */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
              <span className="text-slate-500 block text-[11px]">Base Weights:</span>
              <span className="text-white font-bold text-sm tabular-nums">
                {result.baseWeightsVramGb} GB
              </span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
              <span className="text-slate-500 block text-[11px]">Latent Activations:</span>
              <span className="text-white font-bold text-sm tabular-nums">
                {result.activationsVramGb} GB
              </span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
              <span className="text-slate-500 block text-[11px]">LoRA Adapters:</span>
              <span className="text-white font-bold text-sm tabular-nums">
                {result.loraVramGb} GB
              </span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
              <span className="text-slate-500 block text-[11px]">ControlNet Weights:</span>
              <span className="text-white font-bold text-sm tabular-nums">
                {result.controlNetVramGb} GB
              </span>
            </div>
          </div>

          {/* Warnings and Architectural Alerts */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((warn, i) => (
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
  );
}
