import { DependencyConflict, DependencyRequirement } from '@/types';

/**
 * Normalizes package names according to PEP 503 (lowercase, dashes instead of underscores).
 */
export function normalizePackageName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

/**
 * Parses a single requirements.txt line into a structured DependencyRequirement.
 */
export function parseRequirementLine(
  rawLine: string,
  folderName: string
): DependencyRequirement | null {
  const line = rawLine.trim();

  // Skip comments, empty lines, and options like --extra-index-url
  if (!line || line.startsWith('#') || line.startsWith('-')) {
    return null;
  }

  // Regex to match package name and optional version specifier
  // e.g. "numpy>=1.24.0", "opencv-python-headless", "protobuf<4.0.0,>=3.20.0"
  const match = line.match(/^([a-zA-Z0-9_\-.]+)(?:([<>=!~]+)\s*([0-9a-zA-Z_\-+.]+))?/);
  if (!match) return null;

  const rawPkg = match[1];
  const comparator = match[2] || undefined;
  const version = match[3] || undefined;

  return {
    nodeFolderName: folderName,
    rawRequirement: line,
    packageName: normalizePackageName(rawPkg),
    comparator,
    version,
  };
}

/**
 * Known mutual exclusion pairs in Python / ComfyUI ecosystem
 */
const MUTUAL_EXCLUSIONS: {
  pair: [string, string];
  severity: 'critical' | 'warning';
  reason: string;
  resolution: string;
}[] = [
  {
    pair: ['opencv-python', 'opencv-python-headless'],
    severity: 'critical',
    reason:
      'Installing both opencv-python and opencv-python-headless creates symbol clashes and crashes GUI/video preview nodes.',
    resolution:
      'Standardize on opencv-python-headless in headless servers, or opencv-python in desktop environments.',
  },
  {
    pair: ['onnxruntime', 'onnxruntime-gpu'],
    severity: 'critical',
    reason:
      'CPU onnxruntime takes precedence over onnxruntime-gpu if installed simultaneously, disabling CUDA acceleration in face/upscale nodes.',
    resolution: 'Uninstall onnxruntime and ensure only onnxruntime-gpu is installed.',
  },
];

/**
 * Analyzes dependency requirements across multiple custom nodes and flags conflicts.
 */
export function detectDependencyConflicts(
  requirementsByNode: Record<string, string[]>
): DependencyConflict[] {
  const allReqs: DependencyRequirement[] = [];

  for (const [folderName, lines] of Object.entries(requirementsByNode)) {
    for (const line of lines) {
      const parsed = parseRequirementLine(line, folderName);
      if (parsed) {
        allReqs.push(parsed);
      }
    }
  }

  const conflicts: DependencyConflict[] = [];
  const reqsByPackage = new Map<string, DependencyRequirement[]>();

  for (const req of allReqs) {
    const list = reqsByPackage.get(req.packageName) || [];
    list.push(req);
    reqsByPackage.set(req.packageName, list);
  }

  // 1. Check Known Mutual Exclusions
  for (const exclusion of MUTUAL_EXCLUSIONS) {
    const [pkgA, pkgB] = exclusion.pair;
    const reqsA = reqsByPackage.get(pkgA) || [];
    const reqsB = reqsByPackage.get(pkgB) || [];

    if (reqsA.length > 0 && reqsB.length > 0) {
      const nodesInvolved = [
        ...reqsA.map((r) => ({ folderName: r.nodeFolderName, requirement: r.rawRequirement })),
        ...reqsB.map((r) => ({ folderName: r.nodeFolderName, requirement: r.rawRequirement })),
      ];

      conflicts.push({
        id: `conflict-exclusion-${pkgA}-${pkgB}`,
        packageName: `${pkgA} ↔ ${pkgB}`,
        severity: exclusion.severity,
        nodesInvolved,
        description: exclusion.reason,
        recommendedResolution: exclusion.resolution,
      });
    }
  }

  // 2. Check Version Incompatibilities per Package
  for (const [pkgName, reqs] of reqsByPackage.entries()) {
    if (reqs.length < 2) continue;

    // Check Major Version Bounds (e.g. numpy < 2 vs numpy >= 2)
    const upperBounds = reqs.filter((r) => r.comparator === '<' || r.comparator === '<=');
    const lowerBounds = reqs.filter((r) => r.comparator === '>' || r.comparator === '>=');

    for (const upper of upperBounds) {
      for (const lower of lowerBounds) {
        if (!upper.version || !lower.version) continue;

        const upperMajor = parseInt(upper.version.split('.')[0], 10);
        const lowerMajor = parseInt(lower.version.split('.')[0], 10);

        if (lowerMajor >= upperMajor) {
          conflicts.push({
            id: `conflict-bound-${pkgName}-${upper.nodeFolderName}-${lower.nodeFolderName}`,
            packageName: pkgName,
            severity: 'critical',
            nodesInvolved: [
              { folderName: upper.nodeFolderName, requirement: upper.rawRequirement },
              { folderName: lower.nodeFolderName, requirement: lower.rawRequirement },
            ],
            description: `Incompatible version boundary: ${upper.nodeFolderName} requires ${upper.rawRequirement}, but ${lower.nodeFolderName} requires ${lower.rawRequirement}.`,
            recommendedResolution: `Pin ${pkgName} to the highest version satisfying the lower bound, or patch ${upper.nodeFolderName} to relax constraints.`,
          });
        }
      }
    }

    // Check Conflicting Exact Pins (e.g. scipy==1.11.0 vs scipy==1.12.0)
    const exactPins = reqs.filter((r) => r.comparator === '==' && r.version);
    const versionsSeen = new Map<string, DependencyRequirement>();

    for (const pin of exactPins) {
      const existing = versionsSeen.get(pin.version!);
      if (versionsSeen.size > 0 && !existing) {
        const otherPin = Array.from(versionsSeen.values())[0];
        conflicts.push({
          id: `conflict-pin-${pkgName}-${pin.nodeFolderName}-${otherPin.nodeFolderName}`,
          packageName: pkgName,
          severity: 'warning',
          nodesInvolved: [
            { folderName: pin.nodeFolderName, requirement: pin.rawRequirement },
            { folderName: otherPin.nodeFolderName, requirement: otherPin.rawRequirement },
          ],
          description: `Conflicting exact versions pinned: "${pin.rawRequirement}" vs "${otherPin.rawRequirement}".`,
          recommendedResolution: `Loosen the pinned version "==" to ">=" in custom_nodes/${pin.nodeFolderName}/requirements.txt.`,
        });
        break;
      }
      versionsSeen.set(pin.version!, pin);
    }
  }

  return conflicts;
}

