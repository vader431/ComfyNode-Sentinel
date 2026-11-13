export interface PipSnapshot {
  capturedAt: string;
  pythonBinary: string;
  packages: Record<string, string>;
}

export interface PipDriftChange {
  name: string;
  from: string;
  to: string;
  isCritical: boolean;
}

export interface PipDriftItem {
  name: string;
  version: string;
  isCritical: boolean;
}

export interface PipDriftDiff {
  added: PipDriftItem[];
  removed: PipDriftItem[];
  changed: PipDriftChange[];
  totalChanges: number;
}

const CRITICAL_PACKAGES = new Set([
  'torch',
  'torchvision',
  'torchaudio',
  'xformers',
  'numpy',
  'transformers',
  'diffusers',
  'accelerate',
  'opencv-python',
  'opencv-python-headless',
  'opencv-contrib-python',
  'pillow',
  'scipy',
  'onnxruntime',
  'onnxruntime-gpu',
]);

function isCriticalPackage(name: string): boolean {
  return CRITICAL_PACKAGES.has(name.toLowerCase());
}

/**
 * Compares two pip package maps (baseline vs current) and returns structured drift.
 */
export function diffPipSnapshots(
  baseline: Record<string, string>,
  current: Record<string, string>
): PipDriftDiff {
  const added: PipDriftItem[] = [];
  const removed: PipDriftItem[] = [];
  const changed: PipDriftChange[] = [];

  const allNames = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  for (const name of Array.from(allNames).sort((a, b) => a.localeCompare(b))) {
    const oldVer = baseline[name];
    const newVer = current[name];
    const critical = isCriticalPackage(name);

    if (oldVer === undefined && newVer !== undefined) {
      added.push({ name, version: newVer, isCritical: critical });
    } else if (oldVer !== undefined && newVer === undefined) {
      removed.push({ name, version: oldVer, isCritical: critical });
    } else if (oldVer !== undefined && newVer !== undefined && oldVer !== newVer) {
      changed.push({ name, from: oldVer, to: newVer, isCritical: critical });
    }
  }

  return {
    added,
    removed,
    changed,
    totalChanges: added.length + removed.length + changed.length,
  };
}

