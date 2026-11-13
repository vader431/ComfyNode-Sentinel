import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pythonBinary =
      typeof body.pythonBinary === 'string' && body.pythonBinary.trim()
        ? body.pythonBinary.trim()
        : 'python';

    const { stdout } = await execFileAsync(
      pythonBinary,
      ['-m', 'pip', 'list', '--format=json'],
      { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }
    );

    const parsed = JSON.parse(stdout) as Array<{ name: string; version: string }>;
    const packages: Record<string, string> = {};
    for (const item of parsed) {
      if (item?.name && item?.version) {
        packages[item.name] = item.version;
      }
    }

    return NextResponse.json({
      capturedAt: new Date().toISOString(),
      pythonBinary,
      count: Object.keys(packages).length,
      packages,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Failed to capture pip list: ${err.message}`
            : 'Failed to capture pip list',
      },
      { status: 500 }
    );
  }
}

