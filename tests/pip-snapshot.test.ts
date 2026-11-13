import { describe, it, expect } from 'vitest';
import { diffPipSnapshots } from '@/lib/pip-snapshot';

describe('diffPipSnapshots', () => {
  it('detects added, removed, and changed packages with critical flags', () => {
    const before = {
      torch: '2.4.1+cu124',
      numpy: '1.26.4',
      einops: '0.8.0',
      'old-pkg': '1.0.0',
    };
    const after = {
      torch: '2.5.0',
      numpy: '2.1.0',
      einops: '0.8.0',
      'new-pkg': '0.2.0',
    };

    const diff = diffPipSnapshots(before, after);
    expect(diff.totalChanges).toBe(4);
    expect(diff.added).toEqual([{ name: 'new-pkg', version: '0.2.0', isCritical: false }]);
    expect(diff.removed).toEqual([{ name: 'old-pkg', version: '1.0.0', isCritical: false }]);
    expect(diff.changed).toEqual([
      { name: 'numpy', from: '1.26.4', to: '2.1.0', isCritical: true },
      { name: 'torch', from: '2.4.1+cu124', to: '2.5.0', isCritical: true },
    ]);
  });

  it('returns zero changes for identical snapshots', () => {
    const snap = { torch: '2.4.1', scipy: '1.14.0' };
    const diff = diffPipSnapshots(snap, { ...snap });
    expect(diff.totalChanges).toBe(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });
});

