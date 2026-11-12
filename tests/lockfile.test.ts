import { describe, it, expect } from 'vitest';
import {
  generateComfyLockfile,
  exportAsPlainUrls,
  calculateReconciliation,
  generateCloudPodBootstrapScript,
} from '@/lib/lockfile';
import { InstalledNode, ComfyLockfile } from '@/types';

const mockNodes: InstalledNode[] = [
  {
    id: 'node-1',
    folderName: 'ComfyUI-Impact-Pack',
    cleanDisplayName: 'Impact Pack',
    enabled: true,
    gitUrl: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack.git',
    currentCommit: '4f2b10a1234567890abcdef',
    branch: 'main',
    hasUpdate: false,
    filesCount: 120,
    sizeMb: 45.2,
    healthStatus: 'compliant',
    healthIssues: [],
    installedAt: '2026-01-10',
    category: 'Workflow & Control',
    author: 'ltdrdata',
    description: 'High performance workflow tools',
    providesNodes: ['ImpactKSampler'],
  },
  {
    id: 'node-2',
    folderName: 'ComfyUI-Manager',
    cleanDisplayName: 'ComfyUI Manager',
    enabled: false,
    gitUrl: 'https://github.com/ltdrdata/ComfyUI-Manager.git',
    currentCommit: 'a1b2c3d4e5f6',
    branch: 'main',
    hasUpdate: true,
    filesCount: 65,
    sizeMb: 12.8,
    healthStatus: 'compliant',
    healthIssues: [],
    installedAt: '2026-01-12',
    category: 'Core Tools',
    author: 'ltdrdata',
    description: 'Package manager for ComfyUI',
    providesNodes: ['ComfyUIManager'],
  },
];

describe('lockfile', () => {
  it('generates a valid comfy-lock.json structure', () => {
    const lockfile = generateComfyLockfile(mockNodes, 'v0.3.18-cu124');
    expect(lockfile.version).toBe('1.0.0');
    expect(lockfile.comfyui_version).toBe('v0.3.18-cu124');
    expect(lockfile.nodes).toHaveLength(2);
    expect(lockfile.nodes[0].name).toBe('ComfyUI-Impact-Pack');
    expect(lockfile.nodes[0].enabled_state).toBe(true);
    expect(lockfile.nodes[1].enabled_state).toBe(false);
  });

  it('exports plain urls with disabled comments', () => {
    const plain = exportAsPlainUrls(mockNodes);
    expect(plain).toContain('https://github.com/ltdrdata/ComfyUI-Impact-Pack.git');
    expect(plain).toContain('https://github.com/ltdrdata/ComfyUI-Manager.git # (disabled)');
  });

  it('calculates 3-way reconciliation correctly', () => {
    const targetLockfile: ComfyLockfile = {
      version: '1.0.0',
      generated_at: '2026-11-12T00:00:00.000Z',
      comfyui_version: 'v0.3.18',
      nodes: [
        {
          name: 'ComfyUI-Impact-Pack',
          url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack.git',
          commit_hash: '999999999999', // Drifted commit -> should checkout
          branch: 'main',
          enabled_state: true,
        },
        {
          name: 'ComfyUI-Manager',
          url: 'https://github.com/ltdrdata/ComfyUI-Manager.git',
          commit_hash: 'a1b2c3d4e5f6',
          branch: 'main',
          enabled_state: true, // Local is disabled -> should toggle_state
        },
        {
          name: 'ComfyUI-AnimateDiff-Evolved',
          url: 'https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved.git',
          commit_hash: '8888888',
          branch: 'main',
          enabled_state: true, // Missing locally -> should clone
        },
      ],
    };

    const recon = calculateReconciliation(mockNodes, targetLockfile);
    expect(recon.actionsCount.clone).toBe(1);
    expect(recon.actionsCount.checkout).toBe(1);
    expect(recon.actionsCount.toggle_state).toBe(1);

    const cloneItem = recon.items.find((i) => i.action === 'clone');
    expect(cloneItem?.name).toBe('ComfyUI-AnimateDiff-Evolved');

    const checkoutItem = recon.items.find((i) => i.action === 'checkout');
    expect(checkoutItem?.name).toBe('ComfyUI-Impact-Pack');

    const toggleItem = recon.items.find((i) => i.action === 'toggle_state');
    expect(toggleItem?.name).toBe('ComfyUI-Manager');
  });

  it('generates a valid Cloud Pod bootstrap script with Torch Shield filtering', () => {
    const lockfile = generateComfyLockfile(mockNodes);
    const script = generateCloudPodBootstrapScript(lockfile, {
      targetDir: '/workspace/ComfyUI',
      port: 8188,
    });

    expect(script).toContain('#!/usr/bin/env bash');
    expect(script).toContain('TARGET_DIR="/workspace/ComfyUI"');
    expect(script).toContain('git clone "https://github.com/ltdrdata/ComfyUI-Impact-Pack.git"');
    expect(script).toContain('git checkout -q "4f2b10a1234567890abcdef"');
    expect(script).toContain('grep -v -E \'^(torch|torchvision|torchaudio|xformers)');
    expect(script).toContain('mv "custom_nodes/ComfyUI-Manager" "custom_nodes/ComfyUI-Manager.disabled"');
    expect(script).toContain('python3 main.py --listen 0.0.0.0 --port 8188');
  });
});

