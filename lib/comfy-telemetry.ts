import type {
  ComfyDeviceStats,
  ComfyLiveTelemetry,
  ComfyQueueItemSummary,
  ComfyQueueState,
  ComfySystemStats,
  ComfyWsProgressState,
} from '@/types';

const GIB_BYTES = 1024 * 1024 * 1024;

export function bytesToGiB(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Number((bytes / GIB_BYTES).toFixed(2));
}

export function formatGiB(bytes: number): string {
  return `${bytesToGiB(bytes).toFixed(1)} GiB`;
}

export interface PrimaryGpuSummary {
  deviceName: string;
  shortName: string;
  vramUsedBytes: number;
  vramTotalBytes: number;
  vramFreeBytes: number;
  vramUsedGiB: number;
  vramTotalGiB: number;
  vramPercent: number;
  pressureTone: 'nominal' | 'elevated' | 'critical';
}

export function summarizePrimaryGpu(devices?: ComfyDeviceStats[] | null): PrimaryGpuSummary | null {
  if (!devices || devices.length === 0) return null;
  const primary = devices[0];
  const total = Math.max(0, Number(primary.vram_total) || 0);
  const free = Math.max(0, Math.min(total, Number(primary.vram_free) || 0));
  const used = Math.max(0, total - free);
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  const rawName = (primary.name || 'GPU 0').replace(/^cuda:\d+\s*/i, '').trim();
  const shortName = rawName
    .replace(/NVIDIA\s+GeForce\s+/i, '')
    .replace(/NVIDIA\s+/i, '')
    .replace(/AMD\s+Radeon\s+/i, '')
    .split(':')[0]
    .trim();

  const pressureTone: PrimaryGpuSummary['pressureTone'] =
    percent >= 90 ? 'critical' : percent >= 75 ? 'elevated' : 'nominal';

  return {
    deviceName: rawName || 'GPU 0',
    shortName: shortName || 'GPU 0',
    vramUsedBytes: used,
    vramTotalBytes: total,
    vramFreeBytes: free,
    vramUsedGiB: bytesToGiB(used),
    vramTotalGiB: bytesToGiB(total),
    vramPercent: percent,
    pressureTone,
  };
}

/**
 * Parses a raw ComfyUI /queue JSON payload into a structured ComfyQueueState.
 * ComfyUI queue items are tuples: [number, prompt_id, prompt_graph_dict, extra_data, outputs_to_execute]
 */
export function parseComfyQueuePayload(raw: unknown): ComfyQueueState {
  const empty: ComfyQueueState = {
    runningCount: 0,
    pendingCount: 0,
    runningItems: [],
    pendingItems: [],
  };

  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as { queue_running?: unknown[]; queue_pending?: unknown[] };

  const parseTupleList = (items: unknown[] | undefined): ComfyQueueItemSummary[] => {
    if (!Array.isArray(items)) return [];
    return items
      .map((entry, idx): ComfyQueueItemSummary | null => {
        if (!Array.isArray(entry)) return null;
        const number = typeof entry[0] === 'number' ? entry[0] : idx + 1;
        const promptId = typeof entry[1] === 'string' ? entry[1] : `prompt-${number}`;
        const graph = entry[2];
        const nodeCount =
          graph && typeof graph === 'object' && !Array.isArray(graph)
            ? Object.keys(graph as Record<string, unknown>).length
            : 0;
        return { promptId, number, nodeCount };
      })
      .filter((x): x is ComfyQueueItemSummary => x !== null);
  };

  const runningItems = parseTupleList(obj.queue_running);
  const pendingItems = parseTupleList(obj.queue_pending);

  return {
    runningCount: runningItems.length,
    pendingCount: pendingItems.length,
    runningItems,
    pendingItems,
  };
}

/**
 * Applies a ComfyUI WebSocket JSON message to the current ComfyWsProgressState.
 */
export function applyComfyWsMessage(
  prev: ComfyWsProgressState,
  rawMessage: string
): {
  next: ComfyWsProgressState;
  queueRemaining?: number;
} {
  try {
    const parsed = JSON.parse(rawMessage) as {
      type?: string;
      data?: Record<string, unknown>;
    };
    if (!parsed || typeof parsed.type !== 'string') {
      return { next: prev };
    }

    const data = parsed.data || {};
    switch (parsed.type) {
      case 'status': {
        const statusObj = data.status as { exec_info?: { queue_remaining?: number } } | undefined;
        const queueRemaining = statusObj?.exec_info?.queue_remaining;
        if (queueRemaining === 0) {
          return {
            next: {
              ...prev,
              executingNode: null,
              currentPromptId: null,
              stepProgress: null,
            },
            queueRemaining: 0,
          };
        }
        return {
          next: prev,
          queueRemaining: typeof queueRemaining === 'number' ? queueRemaining : undefined,
        };
      }
      case 'execution_start': {
        const promptId = typeof data.prompt_id === 'string' ? data.prompt_id : prev.currentPromptId;
        return {
          next: {
            ...prev,
            currentPromptId: promptId,
            stepProgress: null,
          },
        };
      }
      case 'executing': {
        const node = data.node;
        const promptId = typeof data.prompt_id === 'string' ? data.prompt_id : prev.currentPromptId;
        if (node === null || node === undefined) {
          return {
            next: {
              ...prev,
              executingNode: null,
              currentPromptId: null,
              stepProgress: null,
            },
          };
        }
        return {
          next: {
            ...prev,
            executingNode: String(node),
            currentPromptId: promptId,
          },
        };
      }
      case 'progress': {
        const value = Number(data.value);
        const max = Number(data.max);
        const promptId = typeof data.prompt_id === 'string' ? data.prompt_id : prev.currentPromptId;
        const node = data.node !== undefined && data.node !== null ? String(data.node) : prev.executingNode;
        if (Number.isFinite(value) && Number.isFinite(max) && max > 0) {
          return {
            next: {
              ...prev,
              currentPromptId: promptId,
              executingNode: node,
              stepProgress: { value, max },
            },
          };
        }
        return { next: prev };
      }
      case 'execution_error':
      case 'execution_interrupted': {
        return {
          next: {
            ...prev,
            executingNode: null,
            currentPromptId: null,
            stepProgress: null,
          },
        };
      }
      default:
        return { next: prev };
    }
  } catch {
    return { next: prev };
  }
}

export async function fetchComfyTelemetry(port = 8188): Promise<ComfyLiveTelemetry> {
  const safePort = Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : 8188;
  try {
    const res = await fetch(`/api/comfy/telemetry?port=${safePort}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as ComfyLiveTelemetry;
  } catch {
    return {
      online: false,
      port: safePort,
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
  }
}

export type ComfyTelemetryControlAction =
  | 'interrupt'
  | 'clear_queue'
  | 'delete_queue_item'
  | 'free_vram';

export async function sendComfyTelemetryAction(params: {
  port?: number;
  action: ComfyTelemetryControlAction;
  promptId?: string;
  unloadModels?: boolean;
  freeMemory?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/comfy/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        message: data.error || data.message || `Action ${params.action} failed`,
      };
    }
    return {
      ok: true,
      message: data.message || 'Command sent to ComfyUI.',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to reach ComfyUI telemetry endpoint',
    };
  }
}

export function normalizeComfySystemStats(raw: unknown): ComfySystemStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as {
    system?: Record<string, unknown>;
    devices?: Array<Record<string, unknown>>;
  };
  if (!obj.system || typeof obj.system !== 'object') return null;

  const sys = obj.system;
  const devicesRaw = Array.isArray(obj.devices) ? obj.devices : [];

  return {
    system: {
      os: String(sys.os || 'unknown'),
      ram_total: Number(sys.ram_total) || 0,
      ram_free: Number(sys.ram_free) || 0,
      comfyui_version: sys.comfyui_version ? String(sys.comfyui_version) : undefined,
      python_version: String(sys.python_version || '').split(' ')[0] || 'unknown',
      pytorch_version: String(sys.pytorch_version || 'unknown'),
      embedded_python: Boolean(sys.embedded_python),
    },
    devices: devicesRaw.map((d, idx) => ({
      name: String(d.name || `Device ${idx}`),
      type: String(d.type || 'cuda'),
      index: typeof d.index === 'number' ? d.index : idx,
      vram_total: Number(d.vram_total) || 0,
      vram_free: Number(d.vram_free) || 0,
      torch_vram_total: Number(d.torch_vram_total) || 0,
      torch_vram_free: Number(d.torch_vram_free) || 0,
    })),
  };
}
