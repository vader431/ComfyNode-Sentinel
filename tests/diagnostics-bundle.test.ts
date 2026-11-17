import { describe, expect, it } from 'vitest';
import { buildDiagnosticsMarkdown, redactUserPaths } from '@/lib/diagnostics-bundle';
import type { EnvironmentSettings } from '@/types';

describe('diagnostics-bundle', () => {
  it('redacts Windows, Linux, and macOS usernames from paths', () => {
    expect(redactUserPaths('C:\\Users\\Alice\\ComfyUI\\main.py')).toBe(
      'C:\\Users\\<user>\\ComfyUI\\main.py'
    );
    expect(redactUserPaths('/home/bob/ComfyUI/custom_nodes')).toBe(
      '/home/<user>/ComfyUI/custom_nodes'
    );
    expect(redactUserPaths('/Users/charlie/AI/ComfyUI')).toBe('/Users/<user>/AI/ComfyUI');
  });

  it('builds a complete redacted markdown diagnostic report', () => {
    const settings: EnvironmentSettings = {
      comfyRoot: 'C:\\Users\\Alice\\ComfyUI',
      pythonBinary: 'C:\\Users\\Alice\\ComfyUI\\venv\\Scripts\\python.exe',
      pythonType: 'virtualenv',
      isValidRoot: true,
      hasMainPy: true,
      hasCustomNodes: true,
      showCleanNames: true,
      autoTorchShield: true,
      comfyPort: 8188,
      launchArgs: ['--lowvram'],
    };

    const report = buildDiagnosticsMarkdown({
      appVersion: '0.5.1',
      isTauri: true,
      desktopInfo: {
        os: 'windows',
        arch: 'x86_64',
        hasBundledNode: true,
        bundledNodePath: null,
        hasStandaloneServer: true,
      },
      settings,
      installedNodes: [],
      logs: [{ id: '1', timestamp: '10:00:00', type: 'stderr', text: 'File "C:\\Users\\Alice\\x.py"' }],
      generatedAt: '2026-11-16T00:00:00Z',
    });

    expect(report).toContain('v0.5.1');
    expect(report).toContain('C:\\Users\\<user>\\ComfyUI');
    expect(report).not.toContain('Alice');
    expect(report).toContain('--lowvram');
  });
});
