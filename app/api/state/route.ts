import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getRuntimeHomeDir } from '@/lib/server-fs';

function getStateFilePath(): string {
  const home = getRuntimeHomeDir();
  return path.join(home, '.comfynode-sentinel', 'state.json');
}

export interface PersistedAppState {
  settings?: Record<string, unknown>;
  instances?: unknown[];
  activeInstanceId?: string;
  profiles?: unknown[];
  activeProfileId?: string;
  aliases?: Record<string, string>;
  transactions?: unknown[];
}

export async function GET() {
  try {
    const filePath = getStateFilePath();
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ exists: false, state: null });
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const state = JSON.parse(raw) as PersistedAppState;
    return NextResponse.json({ exists: true, state });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read persisted state' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const incoming = (await req.json()) as PersistedAppState;
    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'Invalid state payload' }, { status: 400 });
    }

    const filePath = getStateFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    let existing: PersistedAppState = {};
    if (fs.existsSync(filePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PersistedAppState;
      } catch {
        existing = {};
      }
    }

    const merged: PersistedAppState = {
      ...existing,
      ...incoming,
    };

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to persist state' },
      { status: 500 }
    );
  }
}
