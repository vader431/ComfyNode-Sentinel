import { InstalledNode, RegistryNode } from '@/types';

/**
 * Normalizes a Git repository URL for reliable cross-format comparison
 * (HTTPS, HTTP, SSH `git@host:owner/repo`, `ssh://`, trailing slashes, and `.git` suffix).
 */
export function normalizeRegistryGitUrl(url: string): string {
  if (!url) return '';
  return url
    .trim()
    .replace(/^ssh:\/\/git@([^/]+)\//i, 'https://$1/')
    .replace(/^git@([^:]+):/i, 'https://$1/')
    .replace(/^http:\/\//i, 'https://')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .toLowerCase();
}

/**
 * Extracts the repository slug (last path segment) from a Git URL.
 */
export function extractRepoSlug(url: string): string {
  const norm = normalizeRegistryGitUrl(url);
  if (!norm) return '';
  const parts = norm.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

/**
 * Normalizes an installed custom node folder name by stripping `.disabled`.
 */
export function normalizeFolderKey(folderName: string): string {
  return (folderName || '').trim().replace(/\.disabled$/i, '').toLowerCase();
}

/**
 * Builds an O(1) matcher from installed nodes to identify whether a registry
 * node is already installed on disk (matching by normalized Git URL first, then
 * falling back to folder name vs. repo slug or registry name).
 */
export function createInstalledNodeMatcher(installedNodes: InstalledNode[]) {
  const byGitUrl = new Map<string, InstalledNode>();
  const byFolder = new Map<string, InstalledNode>();

  for (const node of installedNodes) {
    const normUrl = normalizeRegistryGitUrl(node.gitUrl);
    if (normUrl && !byGitUrl.has(normUrl)) {
      byGitUrl.set(normUrl, node);
    }
    const folderKey = normalizeFolderKey(node.folderName);
    if (folderKey && !byFolder.has(folderKey)) {
      byFolder.set(folderKey, node);
    }
  }

  return (regNode: Pick<RegistryNode, 'gitUrl' | 'name'>): InstalledNode | undefined => {
    const normUrl = normalizeRegistryGitUrl(regNode.gitUrl);
    if (normUrl) {
      const urlMatch = byGitUrl.get(normUrl);
      if (urlMatch) return urlMatch;
    }

    const repoSlug = extractRepoSlug(regNode.gitUrl);
    if (repoSlug) {
      const slugMatch = byFolder.get(repoSlug);
      if (slugMatch) return slugMatch;
    }

    const nameKey = (regNode.name || '').trim().toLowerCase();
    if (nameKey) {
      const nameMatch = byFolder.get(nameKey);
      if (nameMatch) return nameMatch;
    }

    return undefined;
  };
}
