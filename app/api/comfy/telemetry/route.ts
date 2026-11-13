import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeComfySystemStats,
  parseComfyQueuePayload,
  type ComfyTelemetryControlAction,
} from '@/lib/comfy-telemetry';
import type { ComfyLiveTelemetry } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveSafePort(rawPort: unknown): number {
  const num = Number(rawPort);
  if (Number.isInteger(num) && num >= 1024 && num <= 65535) {
    return num;
  }
  return 8188;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 2200, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const portParam = req.nextUrl.searchParams.get('port');
  const port = resolveSafePort(portParam);
  const baseUrl = `http://127.0.0.1:${port}`;
  const startTime = Date.now();

  try {
    const [statsRes, queueRes] = await Promise.all([
      fetchJsonWithTimeout(`${baseUrl}/system_stats`, 2000),
      fetchJsonWithTimeout(`${baseUrl}/queue`, 2000).catch(() => null),
    ]);

    if (!statsRes.ok) {
      const offlinePayload: ComfyLiveTelemetry = {
        online: false,
        port,
        latencyMs: null,
        systemStats: null,
        queue: {
          runningCount: 0,
          pendingCount: 0,
          runningItems: [],
          pendingItems: [],
        },
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json(offlinePayload);
    }

    const latencyMs = Math.max(1, Date.now() - startTime);
    const rawStats = await statsRes.json();
    const rawQueue = queueRes && queueRes.ok ? await queueRes.json() : null;

    const payload: ComfyLiveTelemetry = {
      online: true,
      port,
      latencyMs,
      systemStats: normalizeComfySystemStats(rawStats),
      queue: parseComfyQueuePayload(rawQueue),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch {
    const offlinePayload: ComfyLiveTelemetry = {
      online: false,
      port,
      latencyMs: null,
      systemStats: null,
      queue: {
        runningCount: 0,
        pendingCount: 0,
        runningItems: [],
        pendingItems: [],
      },
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(offlinePayload);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      port?: number;
      action?: ComfyTelemetryControlAction;
      promptId?: string;
      unloadModels?: boolean;
      freeMemory?: boolean;
    };

    const port = resolveSafePort(body.port);
    const baseUrl = `http://127.0.0.1:${port}`;
    const action = body.action;

    if (!action) {
      return NextResponse.json({ ok: false, error: 'Missing telemetry action' }, { status: 400 });
    }

    if (action === 'interrupt') {
      const res = await fetchJsonWithTimeout(`${baseUrl}/interrupt`, 3500, {
        method: 'POST',
      });
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `ComfyUI /interrupt returned HTTP ${res.status}` },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: 'Interrupted active ComfyUI generation.',
      });
    }

    if (action === 'clear_queue') {
      const res = await fetchJsonWithTimeout(`${baseUrl}/queue`, 3500, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      });
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `ComfyUI /queue clear returned HTTP ${res.status}` },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: 'Cleared pending ComfyUI queue.',
      });
    }

    if (action === 'delete_queue_item') {
      if (!body.promptId) {
        return NextResponse.json({ ok: false, error: 'Missing promptId to delete' }, { status: 400 });
      }
      const res = await fetchJsonWithTimeout(`${baseUrl}/queue`, 3500, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete: [body.promptId] }),
      });
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `ComfyUI /queue delete returned HTTP ${res.status}` },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: `Removed prompt ${body.promptId.slice(0, 8)} from pending queue.`,
      });
    }

    if (action === 'free_vram') {
      const unload_models = body.unloadModels !== false;
      const free_memory = body.freeMemory !== false;
      const res = await fetchJsonWithTimeout(`${baseUrl}/free`, 5000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unload_models, free_memory }),
      });
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `ComfyUI /free returned HTTP ${res.status}` },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: unload_models
          ? 'Unloaded cached models and flushed CUDA VRAM.'
          : 'Flushed ComfyUI CUDA memory cache.',
      });
    }

    return NextResponse.json({ ok: false, error: `Unsupported action: ${String(action)}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to communicate with ComfyUI server',
      },
      { status: 502 }
    );
  }
}
