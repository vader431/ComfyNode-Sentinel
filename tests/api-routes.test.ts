import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { expandHomeDir, validateComfyEnvironment } from '@/lib/server-fs';
import { POST as envPost } from '@/app/api/environment/route';
import { POST as nodesScanPost } from '@/app/api/nodes/scan/route';
import { POST as nodesActionPost } from '@/app/api/nodes/action/route';
import { POST as modelsScanPost } from '@/app/api/models/scan/route';

function makeJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('API Route & Filesystem Integration', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-api-test-'));
    fs.writeFileSync(path.join(tempRoot, 'main.py'), '# ComfyUI entry\n');
    fs.mkdirSync(path.join(tempRoot, 'custom_nodes'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'models', 'checkpoints'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('expands ~ to os.homedir() and validates ComfyUI roots', async () => {
    expect(expandHomeDir('~')).toBe(os.homedir());
    expect(expandHomeDir('~/ComfyUI')).toBe(path.join(os.homedir(), 'ComfyUI'));

    const valid = await validateComfyEnvironment(tempRoot);
    expect(valid.isValidRoot).toBe(true);
    expect(valid.hasMainPy).toBe(true);
    expect(valid.hasCustomNodes).toBe(true);

    const missing = await validateComfyEnvironment(path.join(tempRoot, 'does-not-exist'));
    expect(missing.isValidRoot).toBe(false);
  });

  it('POST /api/environment validates a real temp ComfyUI directory', async () => {
    const res = await envPost(
      makeJsonRequest('http://localhost/api/environment', { comfyRoot: tempRoot })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isValidRoot).toBe(true);
    expect(data.hasMainPy).toBe(true);
    expect(data.hasCustomNodes).toBe(true);
  });

  it('POST /api/nodes/scan discovers active, disabled, and quarantined nodes', async () => {
    const activeNode = path.join(tempRoot, 'custom_nodes', 'ComfyUI-Alpha');
    const disabledNode = path.join(tempRoot, 'custom_nodes', 'ComfyUI-Beta.disabled');
    const trashNode = path.join(tempRoot, '.sentinel_trash', 'ComfyUI-Old');
    fs.mkdirSync(activeNode, { recursive: true });
    fs.mkdirSync(disabledNode, { recursive: true });
    fs.mkdirSync(trashNode, { recursive: true });
    fs.writeFileSync(path.join(activeNode, 'requirements.txt'), 'numpy>=1.26\n');
    fs.writeFileSync(path.join(activeNode, 'init.py'), 'from custom_nodes.ComfyUI_Alpha import x\n');

    const res = await nodesScanPost(
      makeJsonRequest('http://localhost/api/nodes/scan', { comfyRoot: tempRoot })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.nodes).toHaveLength(2);
    expect(data.trashNodes).toHaveLength(1);
    const alpha = data.nodes.find((n: { folderName: string }) => n.folderName === 'ComfyUI-Alpha');
    const beta = data.nodes.find((n: { folderName: string }) => n.folderName === 'ComfyUI-Beta.disabled');
    expect(alpha?.enabled).toBe(true);
    expect(beta?.enabled).toBe(false);
    expect(data.requirementsMap['ComfyUI-Alpha']).toEqual(['numpy>=1.26']);
    expect(alpha?.healthIssues?.length).toBeGreaterThan(0);
  });

  it('POST /api/nodes/action toggles, quarantines, restores, and normalizes folders', async () => {
    const nodeDir = path.join(tempRoot, 'custom_nodes', 'my_custom_node');
    fs.mkdirSync(nodeDir, { recursive: true });

    // Normalize
    const normRes = await nodesActionPost(
      makeJsonRequest('http://localhost/api/nodes/action', {
        action: 'normalize',
        comfyRoot: tempRoot,
        folderName: 'my_custom_node',
        proposedName: 'ComfyUI-MyCustomNode',
      })
    );
    expect(normRes.status).toBe(200);
    expect(fs.existsSync(path.join(tempRoot, 'custom_nodes', 'ComfyUI-MyCustomNode'))).toBe(true);

    // Toggle off
    const toggleOff = await nodesActionPost(
      makeJsonRequest('http://localhost/api/nodes/action', {
        action: 'toggle',
        comfyRoot: tempRoot,
        folderName: 'ComfyUI-MyCustomNode',
      })
    );
    expect(toggleOff.status).toBe(200);
    expect(fs.existsSync(path.join(tempRoot, 'custom_nodes', 'ComfyUI-MyCustomNode.disabled'))).toBe(true);

    // Uninstall to trash
    const uninstallRes = await nodesActionPost(
      makeJsonRequest('http://localhost/api/nodes/action', {
        action: 'uninstall',
        comfyRoot: tempRoot,
        folderName: 'ComfyUI-MyCustomNode.disabled',
      })
    );
    expect(uninstallRes.status).toBe(200);
    expect(fs.existsSync(path.join(tempRoot, '.sentinel_trash', 'ComfyUI-MyCustomNode'))).toBe(true);

    // Restore from trash
    const restoreRes = await nodesActionPost(
      makeJsonRequest('http://localhost/api/nodes/action', {
        action: 'restore',
        comfyRoot: tempRoot,
        folderName: 'ComfyUI-MyCustomNode',
      })
    );
    expect(restoreRes.status).toBe(200);
    expect(fs.existsSync(path.join(tempRoot, 'custom_nodes', 'ComfyUI-MyCustomNode'))).toBe(true);
  });

  it('POST /api/models/scan flags duplicate checkpoint files via hash', async () => {
    const ckptDir = path.join(tempRoot, 'models', 'checkpoints');
    const payload = Buffer.from('identical-safetensors-weights-payload');
    fs.writeFileSync(path.join(ckptDir, 'sdxl_a.safetensors'), payload);
    fs.writeFileSync(path.join(ckptDir, 'sdxl_b.safetensors'), payload);

    const res = await modelsScanPost(
      makeJsonRequest('http://localhost/api/models/scan', { comfyRoot: tempRoot })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.models).toHaveLength(2);
    expect(data.models[0].sha256).toBe(data.models[1].sha256);
    expect(data.models.some((m: { isDuplicate: boolean }) => m.isDuplicate)).toBe(true);
  });
});
