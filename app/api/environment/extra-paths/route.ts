import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { expandHomeDir, resolveSafeSubpath } from '@/lib/server-fs';
import { parseExtraModelPathsYaml } from '@/lib/extra-model-paths';

const DEFAULT_TEMPLATE = `# ComfyUI extra_model_paths.yaml
# Point to shared model directories across ComfyUI / A1111 / Forge installs:
#
# shared_models:
#   base_path: D:/AI/Models
#   checkpoints: checkpoints
#   loras: loras
#   vae: vae
#   controlnet: controlnet
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: 'read' | 'save' = body.action === 'save' ? 'save' : 'read';
    const rawRoot = typeof body.comfyRoot === 'string' ? body.comfyRoot : '';
    const comfyRoot = expandHomeDir(rawRoot);

    if (!comfyRoot || !fs.existsSync(comfyRoot)) {
      return NextResponse.json({ error: 'Valid comfyRoot is required.' }, { status: 400 });
    }

    const yamlPath = resolveSafeSubpath(comfyRoot, 'extra_model_paths.yaml');

    if (action === 'save') {
      const content = typeof body.content === 'string' ? body.content : '';
      fs.writeFileSync(yamlPath, content, 'utf-8');
      const parsed = parseExtraModelPathsYaml(content);
      return NextResponse.json({
        success: true,
        exists: true,
        path: yamlPath,
        parsedCount: parsed.length,
      });
    }

    if (!fs.existsSync(yamlPath)) {
      return NextResponse.json({
        exists: false,
        path: yamlPath,
        content: DEFAULT_TEMPLATE,
        parsedCount: 0,
      });
    }

    const content = fs.readFileSync(yamlPath, 'utf-8');
    const parsed = parseExtraModelPathsYaml(content);
    return NextResponse.json({
      exists: true,
      path: yamlPath,
      content,
      parsedCount: parsed.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to access extra_model_paths.yaml' },
      { status: 500 }
    );
  }
}
