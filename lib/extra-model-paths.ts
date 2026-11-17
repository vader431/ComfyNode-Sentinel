import path from 'path';
import type { ModelCategory } from '@/types';

export interface ExtraModelPathEntry {
  section: string;
  category: ModelCategory;
  resolvedDir: string;
}

const SUPPORTED_CATEGORIES = new Set<ModelCategory>([
  'checkpoints',
  'loras',
  'controlnet',
  'vae',
  'upscale_models',
]);

/**
 * Parses ComfyUI's extra_model_paths.yaml into resolved (category, directory) pairs.
 * Supports top-level sections with `base_path:` and single-line or multiline `|` values.
 */
export function parseExtraModelPathsYaml(yamlText: string): ExtraModelPathEntry[] {
  const results: ExtraModelPathEntry[] = [];
  const lines = yamlText.split(/\r?\n/);

  let currentSection = '';
  let basePath = '';
  let multilineCategory: ModelCategory | null = null;

  for (const rawLine of lines) {
    const commentStripped = rawLine.replace(/#.*$/, '');
    if (!commentStripped.trim()) continue;

    const indent = commentStripped.length - commentStripped.trimStart().length;
    const trimmed = commentStripped.trim();

    // Top-level section (e.g. `a111:` or `shared_models:`)
    if (indent === 0 && trimmed.endsWith(':')) {
      currentSection = trimmed.slice(0, -1).trim();
      basePath = '';
      multilineCategory = null;
      continue;
    }

    // Multiline continuation under `category: |`
    if (multilineCategory && indent >= 4 && !trimmed.includes(':')) {
      const resolvedDir = basePath && !path.isAbsolute(trimmed)
        ? path.join(basePath, trimmed)
        : trimmed;
      results.push({ section: currentSection, category: multilineCategory, resolvedDir });
      continue;
    }

    multilineCategory = null;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

    if (key === 'base_path') {
      basePath = val;
      continue;
    }

    if (SUPPORTED_CATEGORIES.has(key as ModelCategory)) {
      const cat = key as ModelCategory;
      if (val === '|' || val === '>') {
        multilineCategory = cat;
        continue;
      }
      if (val) {
        const resolvedDir = basePath && !path.isAbsolute(val) ? path.join(basePath, val) : val;
        results.push({ section: currentSection, category: cat, resolvedDir });
      }
    }
  }

  return results;
}
