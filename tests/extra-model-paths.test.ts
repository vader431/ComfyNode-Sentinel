import { describe, expect, it } from 'vitest';
import path from 'path';
import { parseExtraModelPathsYaml } from '@/lib/extra-model-paths';

describe('extra-model-paths.yaml parser', () => {
  it('parses base_path, single-line, and multiline entries', () => {
    const yaml = `
# Shared models
shared:
  base_path: /mnt/models
  checkpoints: checkpoints
  loras: |
    loras/flux
    loras/sdxl
  vae: /opt/shared/vae
`;
    const parsed = parseExtraModelPathsYaml(yaml);
    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toEqual({
      section: 'shared',
      category: 'checkpoints',
      resolvedDir: path.join('/mnt/models', 'checkpoints'),
    });
    expect(parsed[1]).toEqual({
      section: 'shared',
      category: 'loras',
      resolvedDir: path.join('/mnt/models', 'loras/flux'),
    });
    expect(parsed[2]).toEqual({
      section: 'shared',
      category: 'loras',
      resolvedDir: path.join('/mnt/models', 'loras/sdxl'),
    });
    expect(parsed[3]).toEqual({
      section: 'shared',
      category: 'vae',
      resolvedDir: '/opt/shared/vae',
    });
  });
});
