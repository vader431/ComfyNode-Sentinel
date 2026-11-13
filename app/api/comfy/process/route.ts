import { NextRequest, NextResponse } from 'next/server';
import {
  getComfyProcessStatus,
  restartComfyProcess,
  startComfyProcess,
  stopComfyProcess,
} from '@/lib/comfy-process';

export async function GET(req: NextRequest) {
  const sinceParam = req.nextUrl.searchParams.get('since');
  const sinceId = sinceParam ? Number.parseInt(sinceParam, 10) || 0 : 0;
  const snapshot = await getComfyProcessStatus(sinceId);
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, comfyRoot, pythonBinary, port } = body;
    const resolvedPort = typeof port === 'number' && port > 0 ? port : 8188;

    if (action === 'start') {
      if (typeof comfyRoot !== 'string' || !comfyRoot.trim()) {
        return NextResponse.json({ error: 'comfyRoot is required' }, { status: 400 });
      }
      const snapshot = await startComfyProcess(comfyRoot, pythonBinary || 'python', resolvedPort);
      return NextResponse.json(snapshot);
    }

    if (action === 'stop') {
      const snapshot = await stopComfyProcess();
      return NextResponse.json(snapshot);
    }

    if (action === 'restart') {
      if (typeof comfyRoot !== 'string' || !comfyRoot.trim()) {
        return NextResponse.json({ error: 'comfyRoot is required' }, { status: 400 });
      }
      const snapshot = await restartComfyProcess(comfyRoot, pythonBinary || 'python', resolvedPort);
      return NextResponse.json(snapshot);
    }

    return NextResponse.json({ error: `Unknown action: ${String(action)}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Process control failed' },
      { status: 500 }
    );
  }
}

