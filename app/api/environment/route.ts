import { NextRequest, NextResponse } from 'next/server';
import {
  detectHostComfyCandidates,
  validateComfyEnvironment,
} from '@/lib/server-fs';

export async function GET() {
  try {
    return NextResponse.json(detectHostComfyCandidates());
  } catch (err) {
    return NextResponse.json(
      {
        platform: process.platform,
        arch: process.arch,
        presetPaths: [],
        detectedPaths: [],
        error: err instanceof Error ? err.message : 'Failed to inspect host environment',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const comfyRoot = typeof body.comfyRoot === 'string' ? body.comfyRoot : '';
    const pythonBinary = typeof body.pythonBinary === 'string' ? body.pythonBinary : undefined;

    const result = await validateComfyEnvironment(comfyRoot, pythonBinary);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        isValidRoot: false,
        hasMainPy: false,
        hasCustomNodes: false,
        platform: process.platform,
        arch: process.arch,
        error: err instanceof Error ? err.message : 'Failed to check environment',
      },
      { status: 500 }
    );
  }
}
