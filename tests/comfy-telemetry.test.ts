import { describe, expect, it } from 'vitest';
import {
  applyComfyWsMessage,
  normalizeComfySystemStats,
  parseComfyQueuePayload,
  summarizePrimaryGpu,
} from '../lib/comfy-telemetry';
import {
  classifyReleaseAssetPlatform,
  matchPlatformReleaseAsset,
} from '../lib/tauri-bridge';
import type { ComfyWsProgressState, DesktopReleaseAsset } from '../types';

describe('ComfyUI Telemetry & WebSocket State Machine', () => {
  it('summarizes primary GPU VRAM utilization and pressure thresholds accurately', () => {
    const gib = 1024 * 1024 * 1024;
    const stats = normalizeComfySystemStats({
      system: {
        os: 'nt',
        ram_total: 64 * gib,
        ram_free: 40 * gib,
        python_version: '3.11.9 (tags/v3.11.9:de54cf5)',
        pytorch_version: '2.5.1+cu124',
        embedded_python: true,
      },
      devices: [
        {
          name: 'cuda:0 NVIDIA GeForce RTX 4090 : cudaMallocAsync',
          type: 'cuda',
          index: 0,
          vram_total: 24 * gib,
          vram_free: 6 * gib,
          torch_vram_total: 16 * gib,
          torch_vram_free: 1 * gib,
        },
      ],
    });

    expect(stats).not.toBeNull();
    expect(stats?.system.python_version).toBe('3.11.9');
    const summary = summarizePrimaryGpu(stats?.devices);
    expect(summary).not.toBeNull();
    expect(summary?.shortName).toBe('RTX 4090');
    expect(summary?.vramUsedGiB).toBe(18);
    expect(summary?.vramTotalGiB).toBe(24);
    expect(summary?.vramPercent).toBe(75);
    expect(summary?.pressureTone).toBe('elevated');
  });

  it('parses ComfyUI /queue running and pending tuple arrays', () => {
    const payload = {
      queue_running: [
        [10, 'prompt-uuid-active', { '1': {}, '2': {}, '3': {} }, {}, ['3']],
      ],
      queue_pending: [
        [11, 'prompt-uuid-wait-1', { '1': {}, '2': {} }, {}, ['2']],
        [12, 'prompt-uuid-wait-2', { '1': {}, '2': {}, '3': {}, '4': {} }, {}, ['4']],
      ],
    };

    const parsed = parseComfyQueuePayload(payload);
    expect(parsed.runningCount).toBe(1);
    expect(parsed.pendingCount).toBe(2);
    expect(parsed.runningItems[0]).toEqual({
      number: 10,
      promptId: 'prompt-uuid-active',
      nodeCount: 3,
    });
    expect(parsed.pendingItems[1].nodeCount).toBe(4);
  });

  it('transitions WebSocket executing and step progress states accurately', () => {
    let state: ComfyWsProgressState = {
      wsConnected: true,
      executingNode: null,
      currentPromptId: null,
      stepProgress: null,
    };

    state = applyComfyWsMessage(
      state,
      JSON.stringify({
        type: 'executing',
        data: { node: '14', prompt_id: 'p-100' },
      })
    ).next;
    expect(state.executingNode).toBe('14');
    expect(state.currentPromptId).toBe('p-100');

    state = applyComfyWsMessage(
      state,
      JSON.stringify({
        type: 'progress',
        data: { value: 12, max: 24, prompt_id: 'p-100', node: '14' },
      })
    ).next;
    expect(state.stepProgress).toEqual({ value: 12, max: 24 });

    state = applyComfyWsMessage(
      state,
      JSON.stringify({
        type: 'executing',
        data: { node: null, prompt_id: 'p-100' },
      })
    ).next;
    expect(state.executingNode).toBeNull();
    expect(state.stepProgress).toBeNull();
  });

  it('matches desktop installer assets by OS platform', () => {
    const assets: DesktopReleaseAsset[] = [
      {
        name: 'ComfyNode.Sentinel_0.1.0_x64_en-US.msi',
        downloadUrl: 'https://example.com/win.msi',
        sizeBytes: 85 * 1024 * 1024,
        platformLabel: classifyReleaseAssetPlatform('ComfyNode.Sentinel_0.1.0_x64_en-US.msi'),
      },
      {
        name: 'ComfyNode.Sentinel_0.1.0_aarch64.dmg',
        downloadUrl: 'https://example.com/mac.dmg',
        sizeBytes: 78 * 1024 * 1024,
        platformLabel: classifyReleaseAssetPlatform('ComfyNode.Sentinel_0.1.0_aarch64.dmg'),
      },
      {
        name: 'comfynode-sentinel_0.1.0_amd64.AppImage',
        downloadUrl: 'https://example.com/linux.AppImage',
        sizeBytes: 92 * 1024 * 1024,
        platformLabel: classifyReleaseAssetPlatform('comfynode-sentinel_0.1.0_amd64.AppImage'),
      },
    ];

    expect(matchPlatformReleaseAsset(assets, 'windows')?.name).toContain('.msi');
    expect(matchPlatformReleaseAsset(assets, 'macos')?.name).toContain('.dmg');
    expect(matchPlatformReleaseAsset(assets, 'linux')?.name).toContain('.AppImage');
  });
});
