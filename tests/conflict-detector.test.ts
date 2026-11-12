import { describe, it, expect } from 'vitest';
import {
  parseRequirementLine,
  detectDependencyConflicts,
  normalizePackageName,
} from '@/lib/conflict-detector';

describe('conflict-detector', () => {
  it('normalizes package names with dashes, underscores and uppercase', () => {
    expect(normalizePackageName('OpenCV_Python_Headless')).toBe('opencv-python-headless');
    expect(normalizePackageName('ONNXRuntime_GPU')).toBe('onnxruntime-gpu');
  });

  it('parses requirements.txt lines correctly', () => {
    const parsed = parseRequirementLine('numpy>=1.24.0', 'ImpactPack');
    expect(parsed).toEqual({
      nodeFolderName: 'ImpactPack',
      rawRequirement: 'numpy>=1.24.0',
      packageName: 'numpy',
      comparator: '>=',
      version: '1.24.0',
    });
  });

  it('ignores comments and empty lines', () => {
    expect(parseRequirementLine('# this is a comment', 'NodeA')).toBeNull();
    expect(parseRequirementLine('   ', 'NodeA')).toBeNull();
    expect(parseRequirementLine('--extra-index-url https://...', 'NodeA')).toBeNull();
  });

  it('detects mutual exclusion between opencv-python and opencv-python-headless', () => {
    const sample = {
      'ComfyUI-VideoHelperSuite': ['opencv-python>=4.8.0'],
      'ComfyUI-Reactor': ['opencv-python-headless>=4.8.0'],
    };

    const conflicts = detectDependencyConflicts(sample);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('critical');
    expect(conflicts[0].packageName).toContain('opencv-python');
    expect(conflicts[0].nodesInvolved).toHaveLength(2);
  });

  it('detects major version boundary conflict (e.g. numpy < 2 vs numpy >= 2)', () => {
    const sample = {
      'Legacy-Node': ['numpy<2.0.0'],
      'Modern-Node': ['numpy>=2.0.0'],
    };

    const conflicts = detectDependencyConflicts(sample);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('critical');
    expect(conflicts[0].packageName).toBe('numpy');
    expect(conflicts[0].description).toContain('Incompatible version boundary');
  });

  it('detects exact version pin mismatch', () => {
    const sample = {
      'NodeA': ['scipy==1.11.0'],
      'NodeB': ['scipy==1.12.0'],
    };

    const conflicts = detectDependencyConflicts(sample);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('warning');
    expect(conflicts[0].packageName).toBe('scipy');
    expect(conflicts[0].description).toContain('Conflicting exact versions pinned');
  });

  it('returns empty array when there are no conflicts', () => {
    const sample = {
      'NodeA': ['transformers>=4.40.0', 'einops'],
      'NodeB': ['transformers>=4.41.0', 'scipy>=1.11.0'],
    };

    const conflicts = detectDependencyConflicts(sample);
    expect(conflicts).toHaveLength(0);
  });
});

