import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { BaseModelFamily, ModelAsset, ModelCategory } from '@/types';
import { computeFastFileFingerprint, expandHomeDir } from '@/lib/server-fs';

const MODEL_EXTENSIONS = new Set(['.safetensors', '.ckpt', '.pt', '.pth', '.bin', '.gguf']);
const CATEGORIES: ModelCategory[] = ['checkpoints', 'loras', 'controlnet', 'vae', 'upscale_models'];

function inferBaseModel(fileName: string, relPath: string): BaseModelFamily {
  const lower = `${fileName} ${relPath}`.toLowerCase();
  if (lower.includes('flux')) return 'Flux.1';
  if (lower.includes('hunyuan')) return 'HunyuanVideo';
  if (lower.includes('sd3')) return 'SD3';
  if (lower.includes('sdxl') || lower.includes('xl_') || lower.includes('_xl')) return 'SDXL';
  if (lower.includes('1.5') || lower.includes('1-5') || lower.includes('sd15')) return 'SD1.5';
  return 'Unknown';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawRoot = typeof body.comfyRoot === 'string' ? body.comfyRoot : '';
    const comfyRoot = expandHomeDir(rawRoot);

    if (!comfyRoot || !fs.existsSync(comfyRoot)) {
      return NextResponse.json({ models: [], error: 'ComfyUI root directory not found.' }, { status: 400 });
    }

    const modelsDir = path.join(comfyRoot, 'models');
    if (!fs.existsSync(modelsDir)) {
      return NextResponse.json({ models: [] });
    }

    const scanned: ModelAsset[] = [];

    for (const category of CATEGORIES) {
      const catDir = path.join(modelsDir, category);
      if (!fs.existsSync(catDir)) continue;

      const walk = (dir: string, depth: number) => {
        if (depth > 4) return;
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath, depth + 1);
            continue;
          }
          const ext = path.extname(entry.name).toLowerCase();
          if (!MODEL_EXTENSIONS.has(ext)) continue;

          try {
            const lstat = fs.lstatSync(fullPath);
            const isSymlink = lstat.isSymbolicLink();
            let symlinkTarget: string | undefined;
            if (isSymlink) {
              try {
                symlinkTarget = fs.readlinkSync(fullPath);
              } catch {
                // ignore
              }
            }

            const stat = isSymlink ? fs.statSync(fullPath) : lstat;
            const sizeBytes = isSymlink ? 0 : stat.size;
            const sizeGb = Number((sizeBytes / (1024 * 1024 * 1024)).toFixed(2));
            const relPath = path.relative(comfyRoot, fullPath).replace(/\\/g, '/');

            const hash =
              !isSymlink && sizeBytes > 0
                ? computeFastFileFingerprint(fullPath, sizeBytes)
                : isSymlink
                  ? `symlink-${entry.name}`
                  : '';

            scanned.push({
              id: `model-${Buffer.from(relPath).toString('base64').slice(0, 16)}`,
              fileName: entry.name,
              category,
              relativePath: relPath,
              sizeBytes,
              sizeGb,
              hash,
              baseModel: inferBaseModel(entry.name, relPath),
              isDuplicate: false,
              isSymlink,
              symlinkTarget,
            });
          } catch {
            // ignore broken symlinks or inaccessible files
          }
        }
      };

      walk(catDir, 0);
    }

    // Mark duplicates only for non-symlink, non-empty files with identical hashes
    const hashCounts = new Map<string, number>();
    for (const m of scanned) {
      if (!m.isSymlink && m.sizeBytes > 0 && m.hash) {
        hashCounts.set(m.hash, (hashCounts.get(m.hash) || 0) + 1);
      }
    }
    for (const m of scanned) {
      if (!m.isSymlink && m.sizeBytes > 0 && m.hash && (hashCounts.get(m.hash) || 0) > 1) {
        m.isDuplicate = true;
        m.duplicateGroupId = m.hash;
      }
    }

    return NextResponse.json({ models: scanned });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Model scan failed', models: [] },
      { status: 500 }
    );
  }
}
