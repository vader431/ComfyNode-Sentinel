import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { RegistryNode } from '@/types';

const CACHE_FILE = path.join(os.tmpdir(), 'comfynode-sentinel-registry-cache.json');
const CUSTOM_NODE_LIST_URL =
  'https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/custom-node-list.json';
const EXTENSION_NODE_MAP_URL =
  'https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/extension-node-map.json';

interface CachedRegistryPayload {
  syncedAt: string;
  count: number;
  nodes: RegistryNode[];
}

function normalizeGitUrl(url: string): string {
  return url.trim().replace(/\.git$/i, '').replace(/\/+$/, '').toLowerCase();
}

function inferCategory(title: string, desc: string): RegistryNode['category'] {
  const text = `${title} ${desc}`.toLowerCase();
  if (text.includes('controlnet') || text.includes('preprocessor') || text.includes('pose')) return 'controlnet';
  if (text.includes('animate') || text.includes('video') || text.includes('wan') || text.includes('ltx')) return 'video';
  if (text.includes('ipadapter') || text.includes('lora') || text.includes('flux')) return 'models';
  if (text.includes('upscale') || text.includes('detailer') || text.includes('impact')) return 'image_gen';
  return 'utility';
}

function readCache(): CachedRegistryPayload | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as CachedRegistryPayload;
  } catch {
    return null;
  }
}

export async function GET() {
  const cached = readCache();
  if (!cached) {
    return NextResponse.json({ syncedAt: null, count: 0, nodes: [] });
  }
  return NextResponse.json(cached);
}

export async function POST() {
  try {
    const [listRes, mapRes] = await Promise.all([
      fetch(CUSTOM_NODE_LIST_URL, { signal: AbortSignal.timeout(10000) }),
      fetch(EXTENSION_NODE_MAP_URL, { signal: AbortSignal.timeout(10000) }).catch(() => null),
    ]);

    if (!listRes.ok) {
      throw new Error(`Upstream returned HTTP ${listRes.status}`);
    }

    const listJson = (await listRes.json()) as {
      custom_nodes?: Array<{
        title?: string;
        author?: string;
        reference?: string;
        files?: string[];
        description?: string;
      }>;
    };

    const classMapByUrl = new Map<string, string[]>();
    if (mapRes && mapRes.ok) {
      const mapJson = (await mapRes.json()) as Record<string, [string[], unknown]>;
      for (const [repoUrl, tuple] of Object.entries(mapJson)) {
        if (Array.isArray(tuple) && Array.isArray(tuple[0])) {
          classMapByUrl.set(normalizeGitUrl(repoUrl), tuple[0]);
        }
      }
    }

    const seenUrls = new Set<string>();
    const nodes: RegistryNode[] = [];

    for (const item of listJson.custom_nodes || []) {
      const rawUrl =
        item.reference ||
        (Array.isArray(item.files) ? item.files.find((f) => f.includes('github.com')) : undefined);
      if (!rawUrl || !rawUrl.startsWith('http')) continue;

      const norm = normalizeGitUrl(rawUrl);
      if (seenUrls.has(norm)) continue;
      seenUrls.add(norm);

      const gitUrl = rawUrl.endsWith('.git') ? rawUrl : `${rawUrl.replace(/\/+$/, '')}.git`;
      const name = item.title?.trim() || rawUrl.split('/').pop() || 'Custom Node';
      const description = item.description?.trim() || 'Community ComfyUI custom node.';

      nodes.push({
        id: `mgr-${nodes.length + 1}`,
        name,
        author: item.author?.trim() || 'Community',
        gitUrl,
        description,
        stars: 0,
        category: inferCategory(name, description),
        nodeClasses: classMapByUrl.get(norm) || [],
        requirements: [],
        hasTorchRisk: false,
        recommended: false,
      });
    }

    const payload: CachedRegistryPayload = {
      syncedAt: new Date().toISOString(),
      count: nodes.length,
      nodes,
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload), 'utf-8');
    return NextResponse.json(payload);
  } catch (err) {
    const fallback = readCache();
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to sync upstream registry',
        ...(fallback || { syncedAt: null, count: 0, nodes: [] }),
      },
      { status: 502 }
    );
  }
}

