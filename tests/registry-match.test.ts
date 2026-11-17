import { describe, it, expect } from 'vitest';
import {
  normalizeRegistryGitUrl,
  extractRepoSlug,
  normalizeFolderKey,
  createInstalledNodeMatcher,
} from '@/lib/registry-match';
import { InstalledNode } from '@/types';

function makeInstalled(overrides: Partial<InstalledNode>): InstalledNode {
  return {
    id: 'node-test',
    folderName: 'test-node',
    cleanDisplayName: 'Test Node',
    enabled: true,
    gitUrl: '',
    currentCommit: 'abc1234',
    branch: 'main',
    hasUpdate: false,
    filesCount: 10,
    sizeMb: 1.5,
    healthStatus: 'compliant',
    healthIssues: [],
    installedAt: '2026-01-01',
    category: 'Custom',
    author: 'tester',
    description: 'Test',
    providesNodes: [],
    ...overrides,
  };
}

describe('registry-match', () => {
  it('normalizes HTTPS, HTTP, SSH, trailing slashes, and .git suffixes', () => {
    expect(normalizeRegistryGitUrl('https://github.com/Fannovel16/comfyui_controlnet_aux.git')).toBe(
      'https://github.com/fannovel16/comfyui_controlnet_aux'
    );
    expect(normalizeRegistryGitUrl('http://github.com/Fannovel16/comfyui_controlnet_aux/')).toBe(
      'https://github.com/fannovel16/comfyui_controlnet_aux'
    );
    expect(normalizeRegistryGitUrl('git@github.com:Fannovel16/comfyui_controlnet_aux.git')).toBe(
      'https://github.com/fannovel16/comfyui_controlnet_aux'
    );
    expect(normalizeRegistryGitUrl('ssh://git@github.com/Fannovel16/comfyui_controlnet_aux.GIT')).toBe(
      'https://github.com/fannovel16/comfyui_controlnet_aux'
    );
  });

  it('extracts repo slug and normalizes .disabled folder names', () => {
    expect(extractRepoSlug('https://github.com/cubiq/ComfyUI_IPAdapter_plus.git')).toBe(
      'comfyui_ipadapter_plus'
    );
    expect(normalizeFolderKey('ComfyUI-Impact-Pack.disabled')).toBe('comfyui-impact-pack');
  });

  it('matches installed nodes by SSH/trailing-slash URLs and folderName fallback', () => {
    const installed: InstalledNode[] = [
      makeInstalled({
        folderName: 'my-custom-cnet',
        gitUrl: 'git@github.com:Fannovel16/comfyui_controlnet_aux.git',
      }),
      makeInstalled({
        folderName: 'ComfyUI_IPAdapter_plus',
        gitUrl: '', // zip / non-git install
      }),
      makeInstalled({
        folderName: 'ComfyUI-Impact-Pack.disabled',
        enabled: false,
        gitUrl: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack/',
      }),
    ];

    const match = createInstalledNodeMatcher(installed);

    expect(
      match({
        name: 'comfyui_controlnet_aux',
        gitUrl: 'https://github.com/Fannovel16/comfyui_controlnet_aux.git',
      })?.folderName
    ).toBe('my-custom-cnet');

    expect(
      match({
        name: "Cubiq's IPAdapter Plus",
        gitUrl: 'https://github.com/cubiq/ComfyUI_IPAdapter_plus.git',
      })?.folderName
    ).toBe('ComfyUI_IPAdapter_plus');

    const impact = match({
      name: 'ComfyUI-Impact-Pack',
      gitUrl: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack.git',
    });
    expect(impact?.folderName).toBe('ComfyUI-Impact-Pack.disabled');
    expect(impact?.enabled).toBe(false);

    expect(
      match({
        name: 'Uninstalled-Node',
        gitUrl: 'https://github.com/someone/Uninstalled-Node.git',
      })
    ).toBeUndefined();
  });
});
