import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { expandHomeDir, resolveSafeSubpath } from '@/lib/server-fs';

const ALLOWED_MODEL_TYPES = new Set([
  'checkpoints',
  'loras',
  'controlnet',
  'vae',
  'upscale_models',
  'unet',
  'clip',
]);

const ALLOWED_MODEL_EXTS = new Set([
  '.safetensors',
  '.ckpt',
  '.pt',
  '.pth',
  '.bin',
  '.gguf',
  '.sft',
]);

function inferFileNameFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const lastSeg = parsed.pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(lastSeg);
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawRoot = typeof body.comfyRoot === 'string' ? body.comfyRoot : '';
  const comfyRoot = expandHomeDir(rawRoot);
  const modelType = typeof body.modelType === 'string' ? body.modelType.trim() : 'checkpoints';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const authToken = typeof body.authToken === 'string' ? body.authToken.trim() : '';
  const rawFileName =
    typeof body.fileName === 'string' && body.fileName.trim()
      ? body.fileName.trim()
      : inferFileNameFromUrl(url);

  if (!comfyRoot || !fs.existsSync(comfyRoot)) {
    return Response.json({ error: 'Valid ComfyUI root directory is required.' }, { status: 400 });
  }
  if (!ALLOWED_MODEL_TYPES.has(modelType)) {
    return Response.json({ error: `Unsupported modelType: ${modelType}` }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return Response.json({ error: 'A valid http(s) download URL is required.' }, { status: 400 });
  }

  const safeBaseName = path.basename(rawFileName);
  const ext = path.extname(safeBaseName).toLowerCase();
  if (!safeBaseName || !ALLOWED_MODEL_EXTS.has(ext)) {
    return Response.json(
      { error: 'Filename must end with .safetensors, .ckpt, .pt, .pth, .bin, .gguf, or .sft.' },
      { status: 400 }
    );
  }

  const targetDir = resolveSafeSubpath(comfyRoot, 'models', modelType);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = resolveSafeSubpath(targetDir, safeBaseName);
  const partPath = `${targetPath}.part`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      const abortController = new AbortController();
      req.signal.addEventListener('abort', () => abortController.abort(), { once: true });

      let fileStream: fs.WriteStream | null = null;
      try {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }

        const res = await fetch(url, {
          headers,
          redirect: 'follow',
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          sendEvent({ type: 'error', error: `Download failed (HTTP ${res.status})` });
          controller.close();
          return;
        }

        const totalBytes = Number(res.headers.get('content-length')) || 0;
        let receivedBytes = 0;
        let lastSentAt = Date.now();
        sendEvent({
          type: 'progress',
          receivedBytes: 0,
          totalBytes,
          percent: totalBytes > 0 ? 0 : null,
        });

        fileStream = fs.createWriteStream(partPath);
        const reader = res.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            receivedBytes += value.byteLength;
            fileStream.write(value);
            const now = Date.now();
            if (now - lastSentAt > 200) {
              lastSentAt = now;
              const percent = totalBytes > 0 ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100)) : null;
              sendEvent({ type: 'progress', receivedBytes, totalBytes, percent });
            }
          }
        }

        await new Promise<void>((resolve, reject) => {
          fileStream?.end(() => resolve());
          fileStream?.on('error', reject);
        });

        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        fs.renameSync(partPath, targetPath);

        sendEvent({
          type: 'done',
          path: targetPath,
          fileName: safeBaseName,
          sizeBytes: receivedBytes,
        });
      } catch (err) {
        try {
          fileStream?.destroy();
          if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
        } catch {
          // ignore cleanup errors
        }
        sendEvent({
          type: 'error',
          error: err instanceof Error ? err.message : 'Download aborted or failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
}
