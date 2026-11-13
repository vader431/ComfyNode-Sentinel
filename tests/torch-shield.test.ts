import { describe, it, expect } from 'vitest';
import {
  isTorchProtectedRequirement,
  extractProtectedTorchPackages,
  stripProtectedTorchPackages,
} from '@/lib/torch-shield';

describe('torch-shield', () => {
  it('flags core PyTorch and xformers packages at package boundaries', () => {
    expect(isTorchProtectedRequirement('torch')).toBe(true);
    expect(isTorchProtectedRequirement('torch==2.4.1+cu124')).toBe(true);
    expect(isTorchProtectedRequirement('torch>=2.1.0')).toBe(true);
    expect(isTorchProtectedRequirement('torchvision')).toBe(true);
    expect(isTorchProtectedRequirement('torchaudio==2.4.1')).toBe(true);
    expect(isTorchProtectedRequirement('xformers>=0.0.27')).toBe(true);
    expect(isTorchProtectedRequirement('torch[cuda]>=2.0')).toBe(true);
  });

  it('does NOT falsely flag legitimate packages containing "torch" substring', () => {
    expect(isTorchProtectedRequirement('torchmetrics>=1.2.0')).toBe(false);
    expect(isTorchProtectedRequirement('torchsde==0.2.6')).toBe(false);
    expect(isTorchProtectedRequirement('open-clip-torch>=2.20.0')).toBe(false);
    expect(isTorchProtectedRequirement('pytorch-lightning==2.0.0')).toBe(false);
    expect(isTorchProtectedRequirement('# torch==2.1.0')).toBe(false);
    expect(isTorchProtectedRequirement('--extra-index-url https://download.pytorch.org/whl/cu121')).toBe(false);
  });

  it('extracts and strips only protected PyTorch packages from requirements', () => {
    const reqs = [
      'numpy>=1.26',
      'torch>=2.1.0',
      'torchmetrics',
      'xformers==0.0.27',
      'open-clip-torch',
      'torchaudio',
      'pillow',
    ];

    expect(extractProtectedTorchPackages(reqs)).toEqual([
      'torch>=2.1.0',
      'xformers==0.0.27',
      'torchaudio',
    ]);

    expect(stripProtectedTorchPackages(reqs)).toEqual([
      'numpy>=1.26',
      'torchmetrics',
      'open-clip-torch',
      'pillow',
    ]);
  });
});
