import { describe, it, expect } from 'vitest';
import {
  analyzeModelDuplicates,
  estimateVramRequirements,
  generateSymlinkScript,
} from '../lib/model-manager';
import { ModelAsset } from '../types';

describe('Model Manager Deduplication & Storage Analysis', () => {
  const sampleModels: ModelAsset[] = [
    {
      id: 'm1',
      fileName: 'sdxl_base.safetensors',
      category: 'checkpoints',
      relativePath: 'models/checkpoints/sdxl_base.safetensors',
      sizeBytes: 7000000000,
      sizeGb: 6.6,
      hash: 'hash-sdxl-1',
      baseModel: 'SDXL',
      isDuplicate: true,
      isSymlink: false,
    },
    {
      id: 'm2',
      fileName: 'sdxl_base_copy.safetensors',
      category: 'checkpoints',
      relativePath: 'models/checkpoints/backup/sdxl_base_copy.safetensors',
      sizeBytes: 7000000000,
      sizeGb: 6.6,
      hash: 'hash-sdxl-1',
      baseModel: 'SDXL',
      isDuplicate: true,
      isSymlink: false,
    },
    {
      id: 'm3',
      fileName: 'flux_schnell.safetensors',
      category: 'checkpoints',
      relativePath: 'models/checkpoints/flux_schnell.safetensors',
      sizeBytes: 12000000000,
      sizeGb: 11.9,
      hash: 'hash-flux-2',
      baseModel: 'Flux.1',
      isDuplicate: false,
      isSymlink: false,
    },
  ];

  it('detects duplicate groups and computes potential disk savings', () => {
    const analysis = analyzeModelDuplicates(sampleModels);
    expect(analysis.totalModelsCount).toBe(3);
    expect(analysis.totalStorageGb).toBe(25.1);
    expect(analysis.duplicateGroups.length).toBe(1);
    expect(analysis.duplicateGroups[0].hash).toBe('hash-sdxl-1');
    expect(analysis.duplicateGroups[0].assets.length).toBe(2);
    expect(analysis.potentialSavingsGb).toBe(6.6);
  });

  it('generates Windows PowerShell symlink command script', () => {
    const analysis = analyzeModelDuplicates(sampleModels);
    const script = generateSymlinkScript(analysis.duplicateGroups[0], true);
    expect(script).toContain('New-Item -ItemType SymbolicLink');
    expect(script).toContain('models/checkpoints/sdxl_base.safetensors');
  });

  it('generates Linux/macOS bash symlink command script', () => {
    const analysis = analyzeModelDuplicates(sampleModels);
    const script = generateSymlinkScript(analysis.duplicateGroups[0], false);
    expect(script).toContain('ln -s');
    expect(script).toContain('#!/usr/bin/env bash');
  });
});

describe('Pre-flight Workflow VRAM Estimator', () => {
  it('estimates Flux.1 FP16 VRAM and warns about >24GB memory requirements', () => {
    const result = estimateVramRequirements({
      baseModel: 'Flux.1',
      quantization: 'fp16',
      resolution: '1024x1024',
      batchSize: 1,
      loraCount: 0,
      controlNetCount: 0,
    });

    expect(result.totalPeakVramGb).toBeGreaterThan(24);
    expect(result.fitsIn24Gb).toBe(false);
    expect(result.warnings.some((w) => w.includes('24GB consumer GPU'))).toBe(true);
  });

  it('estimates Flux.1 FP8 and verifies it fits within 24GB GPUs', () => {
    const result = estimateVramRequirements({
      baseModel: 'Flux.1',
      quantization: 'fp8',
      resolution: '1024x1024',
      batchSize: 1,
      loraCount: 1,
      controlNetCount: 0,
    });

    expect(result.totalPeakVramGb).toBeLessThan(23.8);
    expect(result.fitsIn24Gb).toBe(true);
  });

  it('estimates SD 1.5 standard workflow and verifies it fits in 8GB GPUs', () => {
    const result = estimateVramRequirements({
      baseModel: 'SD1.5',
      quantization: 'fp16',
      resolution: '512x512',
      batchSize: 1,
      loraCount: 1,
      controlNetCount: 0,
    });

    expect(result.fitsIn8Gb).toBe(true);
    expect(result.tierRecommendation).toContain('Entry GPU');
  });
});
