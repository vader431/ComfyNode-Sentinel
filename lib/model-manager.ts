import {
  ModelAsset,
  ModelDeduplicationResult,
  VramEstimationParams,
  VramEstimateResult,
} from '../types';

export function analyzeModelDuplicates(models: ModelAsset[]): ModelDeduplicationResult {
  const totalModelsCount = models.length;
  const totalStorageGb = Number(
    models.reduce((acc, m) => acc + m.sizeGb, 0).toFixed(2)
  );

  // Group by content hash
  const groupsByHash = new Map<string, ModelAsset[]>();

  for (const model of models) {
    if (!model.hash) continue;
    const existing = groupsByHash.get(model.hash) || [];
    existing.push(model);
    groupsByHash.set(model.hash, existing);
  }

  const duplicateGroups: ModelDeduplicationResult['duplicateGroups'] = [];
  let potentialSavingsGb = 0;

  for (const [hash, groupAssets] of groupsByHash.entries()) {
    if (groupAssets.length > 1) {
      const primary = groupAssets[0];
      const singleSize = primary.sizeGb;
      const groupSavings = singleSize * (groupAssets.length - 1);
      potentialSavingsGb += groupSavings;

      duplicateGroups.push({
        hash,
        fileName: primary.fileName,
        sizeGb: singleSize,
        assets: groupAssets,
      });
    }
  }

  return {
    totalModelsCount,
    totalStorageGb,
    duplicateGroups,
    potentialSavingsGb: Number(potentialSavingsGb.toFixed(2)),
  };
}

export function estimateVramRequirements(params: VramEstimationParams): VramEstimateResult {
  const {
    baseModel,
    quantization,
    resolution,
    batchSize,
    loraCount,
    controlNetCount,
  } = params;

  // 1. Base weights in GB
  let weightsGb = 4.0;
  switch (baseModel) {
    case 'Flux.1':
      if (quantization === 'q4') weightsGb = 8.5; // GGUF Q4 + text encoders
      else if (quantization === 'fp8') weightsGb = 14.5;
      else weightsGb = 28.5; // FP16 / BF16
      break;
    case 'SDXL':
      if (quantization === 'q4') weightsGb = 3.9;
      else if (quantization === 'fp8') weightsGb = 5.1;
      else weightsGb = 8.4;
      break;
    case 'SD1.5':
      if (quantization === 'fp8' || quantization === 'q4') weightsGb = 1.5;
      else weightsGb = 2.5;
      break;
    case 'SD3':
      if (quantization === 'fp8') weightsGb = 6.2;
      else weightsGb = 11.0;
      break;
    case 'HunyuanVideo':
      if (quantization === 'q4') weightsGb = 9.8;
      else if (quantization === 'fp8') weightsGb = 16.5;
      else weightsGb = 31.0;
      break;
    default:
      weightsGb = 4.0;
  }

  // 2. Activations & Latents
  let activationPerBatchGb = 1.2;
  switch (resolution) {
    case '512x512':
      activationPerBatchGb = 0.5;
      break;
    case '768x768':
      activationPerBatchGb = 1.0;
      break;
    case '1024x1024':
      activationPerBatchGb = 2.0;
      break;
    case '1920x1080':
      activationPerBatchGb = 5.2;
      break;
  }
  const activationsGb = Number((activationPerBatchGb * Math.max(1, batchSize)).toFixed(2));

  // 3. LoRAs
  const loraMultiplier = baseModel === 'Flux.1' ? 0.6 : baseModel === 'SDXL' ? 0.35 : 0.15;
  const loraGb = Number((loraCount * loraMultiplier).toFixed(2));

  // 4. ControlNets
  const controlNetMultiplier = baseModel === 'Flux.1' ? 2.2 : baseModel === 'SDXL' ? 1.4 : 0.7;
  const controlNetGb = Number((controlNetCount * controlNetMultiplier).toFixed(2));

  // 5. Runtime overhead (CUDA allocator buffers, VAE decode context)
  const overheadGb = 0.8;

  const totalPeakVramGb = Number(
    (weightsGb + activationsGb + loraGb + controlNetGb + overheadGb).toFixed(2)
  );

  const fitsIn8Gb = totalPeakVramGb <= 7.8;
  const fitsIn12Gb = totalPeakVramGb <= 11.8;
  const fitsIn16Gb = totalPeakVramGb <= 15.8;
  const fitsIn24Gb = totalPeakVramGb <= 23.8;

  let tierRecommendation = 'Mid-tier GPU (12GB VRAM e.g. RTX 3060 / 4070)';
  if (totalPeakVramGb <= 7.8) {
    tierRecommendation = 'Entry GPU (8GB VRAM e.g. RTX 3070 / 4060)';
  } else if (totalPeakVramGb <= 11.8) {
    tierRecommendation = 'Mid-tier GPU (12GB VRAM e.g. RTX 3060 / 4070)';
  } else if (totalPeakVramGb <= 15.8) {
    tierRecommendation = 'Prosumer GPU (16GB VRAM e.g. RTX 4080 / 4060 Ti 16GB)';
  } else if (totalPeakVramGb <= 23.8) {
    tierRecommendation = 'Enthusiast Flagship (24GB VRAM e.g. RTX 3090 / 4090)';
  } else {
    tierRecommendation = 'Cloud / Data-Center Workstation (A100 / H100 40GB/80GB)';
  }

  const warnings: string[] = [];

  if (totalPeakVramGb > 24) {
    warnings.push(
      'Peak VRAM exceeds standard 24GB consumer GPU limit. Model will spill into slow CPU shared RAM or trigger CUDA Out-of-Memory unless CPU offloading is active.'
    );
  }

  if (totalPeakVramGb > 12 && (quantization === 'fp16' || quantization === 'bf16')) {
    warnings.push(
      'Consider FP8 (e4m3fn) or GGUF Q4 quantization to cut base weights VRAM consumption in half with negligible perceptual quality degradation.'
    );
  }

  if (resolution === '1920x1080' && batchSize > 1) {
    warnings.push(
      'High-resolution rendering (1080p) combined with batch size > 1 creates explosive latent activation memory spikes during VAE decoding.'
    );
  }

  if (loraCount > 4) {
    warnings.push(
      'High number of active LoRA adapters (>4) adds cumulative weight delta overhead and increases runtime inference latency.'
    );
  }

  return {
    baseWeightsVramGb: weightsGb,
    activationsVramGb: activationsGb,
    loraVramGb: loraGb,
    controlNetVramGb: controlNetGb,
    totalPeakVramGb,
    tierRecommendation,
    fitsIn8Gb,
    fitsIn12Gb,
    fitsIn16Gb,
    fitsIn24Gb,
    warnings,
  };
}

export function generateSymlinkScript(
  duplicateGroup: ModelDeduplicationResult['duplicateGroups'][0],
  isWindows: boolean
): string {
  if (duplicateGroup.assets.length < 2) return '# No duplicates in group';

  const primary = duplicateGroup.assets[0];
  const duplicates = duplicateGroup.assets.slice(1);

  if (isWindows) {
    return [
      `# PowerShell Symlink Script: Deduplicate ${duplicateGroup.fileName}`,
      `# Primary file: ${primary.relativePath}`,
      ...duplicates.flatMap((dup) => [
        `Write-Host "Replacing duplicate: ${dup.relativePath} with symlink..."`,
        `Remove-Item -Force "${dup.relativePath}"`,
        `New-Item -ItemType SymbolicLink -Path "${dup.relativePath}" -Target "${primary.relativePath}"`,
      ]),
      `Write-Host "Reclaimed ${((duplicateGroup.assets.length - 1) * duplicateGroup.sizeGb).toFixed(2)} GB of disk space!"`,
    ].join('\r\n');
  }

  return [
    `#!/usr/bin/env bash`,
    `# Symlink deduplication script: ${duplicateGroup.fileName}`,
    `# Primary: ${primary.relativePath}`,
    ...duplicates.flatMap((dup) => [
      `echo "Deduplicating ${dup.relativePath}..."`,
      `rm -f "${dup.relativePath}"`,
      `ln -s "${primary.relativePath}" "${dup.relativePath}"`,
    ]),
    `echo "Reclaimed ${((duplicateGroup.assets.length - 1) * duplicateGroup.sizeGb).toFixed(2)} GB disk space!"`,
  ].join('\n');
}

export const INITIAL_MODEL_ASSETS: ModelAsset[] = [
  {
    id: 'model-flux1-schnell',
    fileName: 'flux1-schnell-fp8.safetensors',
    category: 'checkpoints',
    relativePath: 'models/checkpoints/flux1-schnell-fp8.safetensors',
    sizeBytes: 12777216000,
    sizeGb: 11.9,
    hash: 'a1b2c3d4e5f6001',
    baseModel: 'Flux.1',
    isDuplicate: false,
    isSymlink: false,
  },
  {
    id: 'model-sdxl-base-1',
    fileName: 'sd_xl_base_1.0.safetensors',
    category: 'checkpoints',
    relativePath: 'models/checkpoints/sd_xl_base_1.0.safetensors',
    sizeBytes: 7088263168,
    sizeGb: 6.6,
    hash: '31e35c80fc48002',
    baseModel: 'SDXL',
    isDuplicate: true,
    duplicateGroupId: '31e35c80fc48002',
    isSymlink: false,
  },
  {
    id: 'model-sdxl-base-dup',
    fileName: 'sd_xl_base_1.0_backup.safetensors',
    category: 'checkpoints',
    relativePath: 'models/checkpoints/archive/sd_xl_base_1.0_backup.safetensors',
    sizeBytes: 7088263168,
    sizeGb: 6.6,
    hash: '31e35c80fc48002',
    baseModel: 'SDXL',
    isDuplicate: true,
    duplicateGroupId: '31e35c80fc48002',
    isSymlink: false,
  },
  {
    id: 'model-flux-realism-lora',
    fileName: 'flux_realism_lora_v1.safetensors',
    category: 'loras',
    relativePath: 'models/loras/flux_realism_lora_v1.safetensors',
    sizeBytes: 320000000,
    sizeGb: 0.32,
    hash: 'f99a88b7c6d5003',
    baseModel: 'Flux.1',
    isDuplicate: false,
    isSymlink: false,
  },
  {
    id: 'model-controlnet-depth-sdxl',
    fileName: 'controlnet_depth_sdxl_1.0.safetensors',
    category: 'controlnet',
    relativePath: 'models/controlnet/controlnet_depth_sdxl_1.0.safetensors',
    sizeBytes: 2684354560,
    sizeGb: 2.5,
    hash: '887766554433004',
    baseModel: 'SDXL',
    isDuplicate: false,
    isSymlink: false,
  },
  {
    id: 'model-sd15-v15-pruned',
    fileName: 'v1-5-pruned-emaonly.safetensors',
    category: 'checkpoints',
    relativePath: 'models/checkpoints/v1-5-pruned-emaonly.safetensors',
    sizeBytes: 4265607168,
    sizeGb: 3.97,
    hash: 'cc6f14924c16005',
    baseModel: 'SD1.5',
    isDuplicate: false,
    isSymlink: false,
  },
  {
    id: 'model-sdxl-vae',
    fileName: 'sdxl_vae.safetensors',
    category: 'vae',
    relativePath: 'models/vae/sdxl_vae.safetensors',
    sizeBytes: 350000000,
    sizeGb: 0.33,
    hash: '776655443322006',
    baseModel: 'SDXL',
    isDuplicate: false,
    isSymlink: true,
    symlinkTarget: 'D:/AI_Models/Shared_VAE/sdxl_vae.safetensors',
  },
];
