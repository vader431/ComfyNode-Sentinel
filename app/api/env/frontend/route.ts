import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { expandHomeDir } from '@/lib/server-fs';
import {
  extractFrontendReleasesFromPyPI,
  isValidPackageVersion,
} from '@/lib/frontend-versions';

const execFileAsync = promisify(execFile);
const PACKAGE_NAME = 'comfyui-frontend-package';

async function getInstalledFrontendVersion(pythonBinary: string, cwd?: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      pythonBinary,
      ['-m', 'pip', 'show', PACKAGE_NAME],
      {
        cwd: cwd || undefined,
        windowsHide: true,
        timeout: 15000,
      }
    );
    const match = stdout.match(/^Version:\s*(.+)$/im);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: 'list' | 'install' = body.action === 'install' ? 'install' : 'list';
    const rawRoot = typeof body.comfyRoot === 'string' ? body.comfyRoot : '';
    const resolvedRoot = rawRoot ? expandHomeDir(rawRoot) : undefined;
    const pythonBinary =
      typeof body.pythonBinary === 'string' && body.pythonBinary.trim()
        ? expandHomeDir(body.pythonBinary.trim())
        : 'python';

    if (action === 'install') {
      const version = typeof body.version === 'string' ? body.version.trim() : '';
      if (!isValidPackageVersion(version)) {
        return NextResponse.json(
          { error: 'Invalid frontend package version.' },
          { status: 400 }
        );
      }

      const previousVersion = await getInstalledFrontendVersion(pythonBinary, resolvedRoot);
      const { stdout, stderr } = await execFileAsync(
        pythonBinary,
        ['-m', 'pip', 'install', '--no-input', `${PACKAGE_NAME}==${version}`],
        {
          cwd: resolvedRoot || undefined,
          windowsHide: true,
          timeout: 120000,
        }
      );

      const installedVersion =
        (await getInstalledFrontendVersion(pythonBinary, resolvedRoot)) || version;

      return NextResponse.json({
        success: true,
        previousVersion,
        installedVersion,
        output: [stdout, stderr].filter(Boolean).join('\n').trim(),
      });
    }

    const installedVersion = await getInstalledFrontendVersion(pythonBinary, resolvedRoot);

    const pypiRes = await fetch(`https://pypi.org/pypi/${PACKAGE_NAME}/json`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!pypiRes.ok) {
      return NextResponse.json(
        {
          installedVersion,
          latestVersion: null,
          releases: [],
          error: `PyPI lookup failed (HTTP ${pypiRes.status}).`,
        },
        { status: 502 }
      );
    }

    const pypiData = (await pypiRes.json()) as {
      info?: { version?: string };
      releases?: Record<string, Array<{ upload_time_iso_8601?: string; yanked?: boolean }>>;
    };

    const releases = extractFrontendReleasesFromPyPI(pypiData.releases || {}, 40);
    const latestVersion = pypiData.info?.version || releases[0]?.version || null;

    return NextResponse.json({
      installedVersion,
      latestVersion,
      releases,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Frontend package operation failed',
      },
      { status: 500 }
    );
  }
}
