export interface CoreCommitItem {
  hash: string;
  subject: string;
}

export interface CoreReleaseItem {
  tag: string;
  name: string;
  publishedAt: string | null;
  url: string;
  isPrerelease: boolean;
}

export interface CoreStatusResponse {
  isGitRepo: boolean;
  version: string | null;
  tag: string | null;
  branch: string | null;
  defaultBranch: string | null;
  isDetached: boolean;
  isDirty: boolean;
  commit: string | null;
  behindCount: number;
  hasUpdate: boolean;
  incomingCommits: CoreCommitItem[];
  releases: CoreReleaseItem[];
  latestReleaseTag: string | null;
  hasRequirementsTxt: boolean;
  coreRequirements?: string[];
  message?: string;
  error?: string;
}

/**
 * Parses `__version__ = "..."` from ComfyUI's `comfyui_version.py`.
 */
export function parseComfyVersionFromPython(content: string): string | null {
  const match = content.match(/__version__\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1].trim() : null;
}

/**
 * Parses `version = "..."` from ComfyUI's `pyproject.toml`.
 */
export function parseComfyVersionFromPyproject(content: string): string | null {
  const match = content.match(/^\s*version\s*=\s*['"]([^'"]+)['"]/m);
  return match ? match[1].trim() : null;
}

/**
 * Validates a git branch, tag, or commit hash before passing to `git`.
 */
export function isValidGitRef(ref: string): boolean {
  const trimmed = (ref || '').trim();
  if (!trimmed || trimmed.length > 128) return false;
  if (trimmed.startsWith('-') || trimmed.includes('..') || trimmed.endsWith('/')) return false;
  return /^[a-zA-Z0-9._/-]+$/.test(trimmed);
}

/**
 * Parses `git log --oneline` output into `{ hash, subject }` items.
 */
export function parseGitOnelineLog(stdout: string): CoreCommitItem[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx === -1) return { hash: line, subject: '' };
      return {
        hash: line.slice(0, spaceIdx).trim(),
        subject: line.slice(spaceIdx + 1).trim(),
      };
    });
}

/**
 * Parses a `git --progress` stderr line (split on `\r` or `\n`) into phase + percentage.
 */
export function parseGitProgressLine(line: string): { phase: string; percent: number } | null {
  const match = line.match(
    /(Counting objects|Compressing objects|Receiving objects|Resolving deltas|Updating files|Checking out files):\s*(\d+)%/i
  );
  if (!match) return null;
  const percent = Math.max(0, Math.min(100, Number.parseInt(match[2], 10)));
  return {
    phase: match[1],
    percent,
  };
}
