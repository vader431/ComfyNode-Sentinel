import type { CrashDiagnostic, TerminalLogEntry } from '@/types';

const MODULE_TO_PIP_MAP: Record<string, string> = {
  cv2: 'opencv-python',
  pil: 'Pillow',
  yaml: 'PyYAML',
  skimage: 'scikit-image',
  sklearn: 'scikit-learn',
  bs4: 'beautifulsoup4',
  dotenv: 'python-dotenv',
  dateutil: 'python-dateutil',
  git: 'GitPython',
  google: 'protobuf',
  ffmpeg: 'ffmpeg-python',
  insightface: 'insightface',
  onnxruntime: 'onnxruntime',
  ultralytics: 'ultralytics',
  timm: 'timm',
  einops: 'einops',
  safetensors: 'safetensors',
  transformers: 'transformers',
  accelerate: 'accelerate',
  segment_anything: 'segment-anything',
};

export function resolvePipPackageName(moduleName: string): string {
  const rootModule = moduleName.trim().split('.')[0];
  const mapped = MODULE_TO_PIP_MAP[rootModule.toLowerCase()];
  return mapped || rootModule;
}

/**
 * Extracts a custom_nodes/<folder> name from a filesystem path in a ComfyUI log line.
 */
export function extractCustomNodeFolderFromLine(line: string): string | undefined {
  const match = line.match(/custom_nodes[\\/]([^\\/:\s"']+)/i);
  if (!match) return undefined;
  const candidate = match[1].trim();
  if (!candidate || candidate === '__pycache__') return undefined;
  return candidate;
}

/**
 * Analyzes ComfyUI process & terminal logs to detect failing custom nodes,
 * missing Python modules, and CUDA OOM errors.
 */
export function analyzeComfyLogs(logs: Pick<TerminalLogEntry, 'text' | 'type'>[]): CrashDiagnostic[] {
  const diagnostics: CrashDiagnostic[] = [];
  const seenKeys = new Set<string>();

  let lastTracebackFolder: string | undefined;

  for (let i = 0; i < logs.length; i++) {
    const text = logs[i]?.text ?? '';
    if (!text) continue;

    const folderInLine = extractCustomNodeFolderFromLine(text);
    if (folderInLine && /File\s+["']|IMPORT FAILED/i.test(text)) {
      lastTracebackFolder = folderInLine;
    }

    // 1. Missing Python module (e.g. ModuleNotFoundError: No module named 'cv2')
    const missingModMatch = text.match(/ModuleNotFoundError:\s+No module named\s+['"]([^'"]+)['"]/i);
    if (missingModMatch) {
      const missingModule = missingModMatch[1];
      const suggestedPipPackage = resolvePipPackageName(missingModule);
      const nodeFolder = folderInLine || lastTracebackFolder;
      const dedupeKey = `missing_module:${suggestedPipPackage}:${nodeFolder || ''}`;
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        diagnostics.push({
          id: `diag-${diagnostics.length + 1}`,
          kind: 'missing_module',
          title: `Missing Python module "${missingModule}"`,
          detail: nodeFolder
            ? `Required by ${nodeFolder}. Install "${suggestedPipPackage}" via Torch-Shielded pip.`
            : `Install "${suggestedPipPackage}" via Torch-Shielded pip.`,
          nodeFolderName: nodeFolder,
          missingModule,
          suggestedPipPackage,
        });
      }
      continue;
    }

    // 2. ComfyUI startup IMPORT FAILED summary line
    const importFailedMatch = text.match(/\(IMPORT FAILED\):\s*(.+)$/i);
    if (importFailedMatch) {
      const folder = extractCustomNodeFolderFromLine(importFailedMatch[1]) || lastTracebackFolder;
      const dedupeKey = `import_failed:${folder || importFailedMatch[1].trim()}`;
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        diagnostics.push({
          id: `diag-${diagnostics.length + 1}`,
          kind: 'import_failed',
          title: folder ? `Import failed: ${folder}` : 'Custom node import failed',
          detail: text.trim(),
          nodeFolderName: folder,
        });
      }
      continue;
    }

    // 3. CUDA OutOfMemoryError
    if (/OutOfMemoryError|CUDA out of memory/i.test(text)) {
      const dedupeKey = 'cuda_oom';
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        diagnostics.push({
          id: `diag-${diagnostics.length + 1}`,
          kind: 'cuda_oom',
          title: 'CUDA Out of Memory',
          detail: 'Try freeing VRAM from the Telemetry drawer or launching ComfyUI with --lowvram.',
        });
      }
      continue;
    }

    // 4. Generic Python exception inside custom_nodes/<folder>
    if (
      lastTracebackFolder &&
      /^(ImportError|AttributeError|RuntimeError|TypeError|ValueError|SyntaxError):/i.test(text.trim())
    ) {
      const dedupeKey = `node_traceback:${lastTracebackFolder}:${text.trim().slice(0, 60)}`;
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        diagnostics.push({
          id: `diag-${diagnostics.length + 1}`,
          kind: 'node_traceback',
          title: `Runtime error in ${lastTracebackFolder}`,
          detail: text.trim(),
          nodeFolderName: lastTracebackFolder,
        });
      }
      lastTracebackFolder = undefined;
    }
  }

  return diagnostics;
}
