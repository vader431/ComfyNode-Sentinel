import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { expandHomeDir, resolveSafeSubpath } from '@/lib/server-fs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawRoot = typeof body.comfyRoot === 'string' ? body.comfyRoot : '';
    const comfyRoot = expandHomeDir(rawRoot);
    const { primaryRelativePath, duplicateRelativePaths } = body;

    if (!comfyRoot || !primaryRelativePath || !Array.isArray(duplicateRelativePaths)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const primaryFull = resolveSafeSubpath(comfyRoot, primaryRelativePath);
    if (!fs.existsSync(primaryFull)) {
      return NextResponse.json({ error: 'Primary model file not found' }, { status: 404 });
    }

    const linked: string[] = [];
    const errors: string[] = [];

    for (const dupRel of duplicateRelativePaths) {
      try {
        const dupFull = resolveSafeSubpath(comfyRoot, dupRel);
        if (!fs.existsSync(dupFull)) continue;
        fs.unlinkSync(dupFull);
        fs.symlinkSync(primaryFull, dupFull, 'file');
        linked.push(dupRel);
      } catch (err) {
        errors.push(`${dupRel}: ${err instanceof Error ? err.message : 'Symlink failed (on Windows, Developer Mode or Admin may be required)'}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      linked,
      errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Deduplication failed' },
      { status: 500 }
    );
  }
}
