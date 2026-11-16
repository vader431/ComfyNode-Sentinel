import { describe, expect, it } from 'vitest';
import {
  compareSemverDesc,
  extractFrontendReleasesFromPyPI,
  isValidPackageVersion,
} from '@/lib/frontend-versions';

describe('frontend-versions', () => {
  it('validates safe PyPI package version strings', () => {
    expect(isValidPackageVersion('1.14.6')).toBe(true);
    expect(isValidPackageVersion('1.15.0rc1')).toBe(true);
    expect(isValidPackageVersion('1.0.0; rm -rf /')).toBe(false);
    expect(isValidPackageVersion('')).toBe(false);
  });

  it('sorts semver versions descending numerically', () => {
    const versions = ['1.9.10', '1.14.2', '1.2.0', '1.14.10'];
    expect([...versions].sort(compareSemverDesc)).toEqual([
      '1.14.10',
      '1.14.2',
      '1.9.10',
      '1.2.0',
    ]);
  });

  it('extracts non-yanked PyPI releases sorted newest-first', () => {
    const releases = extractFrontendReleasesFromPyPI({
      '1.9.0': [{ upload_time_iso_8601: '2025-01-01T00:00:00Z', yanked: false }],
      '1.14.5': [{ upload_time_iso_8601: '2025-03-01T00:00:00Z', yanked: false }],
      '1.14.6': [{ upload_time_iso_8601: '2025-03-05T00:00:00Z', yanked: true }],
      '1.12.0': [],
    });

    expect(releases.map((r) => r.version)).toEqual(['1.14.5', '1.9.0']);
  });
});
