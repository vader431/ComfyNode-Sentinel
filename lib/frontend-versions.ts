export interface FrontendReleaseItem {
  version: string;
  releasedAt: string | null;
  yanked: boolean;
}

const SAFE_VERSION_RE = /^[0-9]+(?:\.[0-9]+)*(?:[a-zA-Z0-9.+-]*)?$/;

export function isValidPackageVersion(version: string): boolean {
  const trimmed = version.trim();
  return Boolean(trimmed) && trimmed.length <= 64 && SAFE_VERSION_RE.test(trimmed);
}

export function compareSemverDesc(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number.parseInt(part, 10) : part));
  const pb = b.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number.parseInt(part, 10) : part));
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const va = pa[i];
    const vb = pb[i];
    if (va === undefined) return 1;
    if (vb === undefined) return -1;
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va !== vb) return vb - va;
    } else {
      const sa = String(va);
      const sb = String(vb);
      if (sa !== sb) return sb.localeCompare(sa);
    }
  }
  return 0;
}

export function extractFrontendReleasesFromPyPI(
  releasesObj: Record<string, Array<{ upload_time_iso_8601?: string; yanked?: boolean }>>,
  limit = 40
): FrontendReleaseItem[] {
  const items: FrontendReleaseItem[] = [];

  for (const [version, files] of Object.entries(releasesObj)) {
    if (!Array.isArray(files) || files.length === 0) continue;
    const firstFile = files[0];
    const allYanked = files.every((f) => Boolean(f.yanked));
    if (allYanked) continue;

    items.push({
      version,
      releasedAt: firstFile?.upload_time_iso_8601 || null,
      yanked: false,
    });
  }

  items.sort((a, b) => compareSemverDesc(a.version, b.version));
  return items.slice(0, limit);
}
