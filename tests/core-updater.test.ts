import { describe, it, expect } from 'vitest';
import {
  parseComfyVersionFromPython,
  parseComfyVersionFromPyproject,
  isValidGitRef,
  parseGitOnelineLog,
  parseGitProgressLine,
} from '@/lib/core-updater';

describe('core-updater helpers', () => {
  it('parses ComfyUI version from comfyui_version.py and pyproject.toml', () => {
    expect(parseComfyVersionFromPython(`__version__ = "0.3.26"\n`)).toBe('0.3.26');
    expect(parseComfyVersionFromPython(`__version__ = '0.4.0'`)).toBe('0.4.0');
    expect(parseComfyVersionFromPython(`# no version`)).toBeNull();

    expect(
      parseComfyVersionFromPyproject(`[project]\nname = "ComfyUI"\nversion = "0.3.27"\n`)
    ).toBe('0.3.27');
    expect(parseComfyVersionFromPyproject(`[project]\nname = "ComfyUI"\n`)).toBeNull();
  });

  it('validates git refs safely', () => {
    expect(isValidGitRef('v0.3.26')).toBe(true);
    expect(isValidGitRef('master')).toBe(true);
    expect(isValidGitRef('feature/my-branch')).toBe(true);
    expect(isValidGitRef('a1b2c3d')).toBe(true);

    expect(isValidGitRef('')).toBe(false);
    expect(isValidGitRef('--upload-pack=evil')).toBe(false);
    expect(isValidGitRef('v0.3..v0.4')).toBe(false);
    expect(isValidGitRef('v0.3; rm -rf /')).toBe(false);
    expect(isValidGitRef('refs/heads/')).toBe(false);
  });

  it('parses git oneline logs', () => {
    const out = `abc1234 Fix memory leak in sampler\ndef5678 Add Flux.2 support\n`;
    expect(parseGitOnelineLog(out)).toEqual([
      { hash: 'abc1234', subject: 'Fix memory leak in sampler' },
      { hash: 'def5678', subject: 'Add Flux.2 support' },
    ]);
  });

  it('parses git --progress lines', () => {
    expect(parseGitProgressLine('Receiving objects:  45% (90/200), 12.4 MiB | 4.1 MiB/s')).toEqual({
      phase: 'Receiving objects',
      percent: 45,
    });
    expect(parseGitProgressLine('Resolving deltas: 100% (50/50), done.')).toEqual({
      phase: 'Resolving deltas',
      percent: 100,
    });
    expect(parseGitProgressLine('Updating files:   8% (12/150)')).toEqual({
      phase: 'Updating files',
      percent: 8,
    });
    expect(parseGitProgressLine('Already up to date.')).toBeNull();
  });
});
