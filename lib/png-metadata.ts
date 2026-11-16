/**
 * PNG chunk metadata parser for ComfyUI workflows.
 * Decodes PNG tEXt and iTXt chunks to extract embedded workflow JSON.
 */

import type { WorkflowModelReference } from '@/types';

export interface ExtractedWorkflowData {
  workflowJson: Record<string, unknown> | null;
  nodeTypes: string[];
  modelReferences: WorkflowModelReference[];
  rawText?: string;
  sourceType: 'png-metadata' | 'json-file';
}

/**
 * Extracts embedded workflow from a PNG file buffer or parsed JSON
 */
export async function extractWorkflowFromBuffer(
  file: File
): Promise<ExtractedWorkflowData> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'json') {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const nodeTypes = extractNodeTypesFromJson(parsed);
      return {
        workflowJson: parsed,
        nodeTypes,
        modelReferences: extractModelReferencesFromJson(parsed),
        rawText: text,
        sourceType: 'json-file',
      };
    } catch {
      throw new Error('Invalid JSON workflow file.');
    }
  }

  if (extension === 'png') {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Verify PNG signature: 137 80 78 71 13 10 26 10
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < pngSignature.length; i++) {
      if (bytes[i] !== pngSignature[i]) {
        throw new Error('Uploaded file is not a valid PNG image.');
      }
    }

    let offset = 8;
    const textDecoder = new TextDecoder('utf-8');
    const dataView = new DataView(buffer);

    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) break;

      const length = dataView.getUint32(offset);

      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );

      const chunkDataOffset = offset + 8;

      if (type === 'tEXt') {
        const chunkData = bytes.slice(chunkDataOffset, chunkDataOffset + length);
        let nullIndex = -1;
        for (let i = 0; i < chunkData.length; i++) {
          if (chunkData[i] === 0) {
            nullIndex = i;
            break;
          }
        }

        if (nullIndex !== -1) {
          const keyword = textDecoder.decode(chunkData.slice(0, nullIndex));
          const textValue = textDecoder.decode(chunkData.slice(nullIndex + 1));

          if (keyword === 'workflow' || keyword === 'prompt') {
            try {
              const parsed = JSON.parse(textValue);
              const nodeTypes = extractNodeTypesFromJson(parsed);
              if (nodeTypes.length > 0) {
                return {
                  workflowJson: parsed,
                  nodeTypes,
                  modelReferences: extractModelReferencesFromJson(parsed),
                  rawText: textValue,
                  sourceType: 'png-metadata',
                };
              }
            } catch {
              // try next chunk
            }
          }
        }
      } else if (type === 'iTXt') {
        const chunkData = bytes.slice(chunkDataOffset, chunkDataOffset + length);
        let nullIndex = -1;
        for (let i = 0; i < chunkData.length; i++) {
          if (chunkData[i] === 0) {
            nullIndex = i;
            break;
          }
        }

        if (nullIndex !== -1) {
          const keyword = textDecoder.decode(chunkData.slice(0, nullIndex));
          // Skip compression flag (1 byte), compression method (1 byte)
          let current = nullIndex + 3;
          // Skip language tag
          while (current < chunkData.length && chunkData[current] !== 0) current++;
          current++; // skip null
          // Skip translated keyword
          while (current < chunkData.length && chunkData[current] !== 0) current++;
          current++; // skip null

          if (current < chunkData.length && (keyword === 'workflow' || keyword === 'prompt')) {
            const textValue = textDecoder.decode(chunkData.slice(current));
            try {
              const parsed = JSON.parse(textValue);
              const nodeTypes = extractNodeTypesFromJson(parsed);
              if (nodeTypes.length > 0) {
                return {
                  workflowJson: parsed,
                  nodeTypes,
                  modelReferences: extractModelReferencesFromJson(parsed),
                  rawText: textValue,
                  sourceType: 'png-metadata',
                };
              }
            } catch {
              // Continue checking
            }
          }
        }
      }

      // Next chunk = length + 4(length) + 4(type) + 4(crc)
      offset += length + 12;
    }

    throw new Error('No ComfyUI workflow metadata (tEXt/iTXt chunk) was detected in this PNG file.');
  }

  throw new Error('Unsupported file extension. Please drop a ComfyUI .png image or a .json workflow file.');
}

/**
 * Extracts unique node class names from a ComfyUI workflow object.
 * Supports both UI-style workflow.json (with .nodes array) and API-style prompt.json.
 */
export function extractNodeTypesFromJson(data: unknown): string[] {
  const nodeTypes = new Set<string>();

  if (!data || typeof data !== 'object') return [];

  const obj = data as Record<string, unknown>;

  // Check 1: UI graph format with "nodes" array
  if (Array.isArray(obj.nodes)) {
    for (const node of obj.nodes) {
      if (node && typeof node === 'object' && typeof (node as Record<string, unknown>).type === 'string') {
        nodeTypes.add((node as Record<string, unknown>).type as string);
      }
    }
  }

  // Check 2: API format where keys are node IDs and values have "class_type"
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object') {
      const rec = val as Record<string, unknown>;
      if (typeof rec.class_type === 'string') {
        nodeTypes.add(rec.class_type);
      }
    }
  }

  // Check 3: Nested "prompt" or "extra.prompt"
  if (obj.prompt && typeof obj.prompt === 'object') {
    const nestedPrompt = obj.prompt as Record<string, unknown>;
    for (const key of Object.keys(nestedPrompt)) {
      const val = nestedPrompt[key];
      if (val && typeof val === 'object') {
        const rec = val as Record<string, unknown>;
        if (typeof rec.class_type === 'string') {
          nodeTypes.add(rec.class_type);
        }
      }
    }
  }

  return Array.from(nodeTypes).filter(Boolean);
}

const MODEL_LOADER_TYPE_MAP: Record<string, WorkflowModelReference['modelType']> = {
  CheckpointLoaderSimple: 'checkpoints',
  CheckpointLoader: 'checkpoints',
  unCLIPCheckpointLoader: 'checkpoints',
  LoraLoader: 'loras',
  LoraLoaderModelOnly: 'loras',
  ControlNetLoader: 'controlnet',
  DiffControlNetLoader: 'controlnet',
  VAELoader: 'vae',
  UNETLoader: 'unet',
  CLIPLoader: 'clip',
  DualCLIPLoader: 'clip',
  TripleCLIPLoader: 'clip',
  UpscaleModelLoader: 'upscale_models',
};

const MODEL_FILE_EXT_RE = /\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/i;

function inferModelTypeFromKeyOrNode(
  nodeClass: string,
  inputKey?: string
): WorkflowModelReference['modelType'] {
  if (MODEL_LOADER_TYPE_MAP[nodeClass]) {
    return MODEL_LOADER_TYPE_MAP[nodeClass];
  }
  const key = (inputKey || nodeClass).toLowerCase();
  if (key.includes('lora')) return 'loras';
  if (key.includes('control')) return 'controlnet';
  if (key.includes('vae')) return 'vae';
  if (key.includes('upscale')) return 'upscale_models';
  if (key.includes('unet')) return 'unet';
  if (key.includes('clip')) return 'clip';
  return 'checkpoints';
}

/**
 * Extracts referenced model filenames (checkpoints, LoRAs, ControlNets, VAEs, UNETs, CLIPs)
 * from either UI-style workflow.json or API-style prompt.json.
 */
export function extractModelReferencesFromJson(data: unknown): WorkflowModelReference[] {
  if (!data || typeof data !== 'object') return [];

  const refs: WorkflowModelReference[] = [];
  const seen = new Set<string>();

  const addRef = (fileName: string, nodeClass: string, inputKey?: string) => {
    const trimmed = fileName.trim();
    if (!trimmed || !MODEL_FILE_EXT_RE.test(trimmed)) return;
    const modelType = inferModelTypeFromKeyOrNode(nodeClass, inputKey);
    const dedupeKey = `${modelType}:${trimmed.toLowerCase()}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    refs.push({ fileName: trimmed, modelType, nodeClass });
  };

  const inspectPromptGraph = (graph: Record<string, unknown>) => {
    for (const val of Object.values(graph)) {
      if (!val || typeof val !== 'object') continue;
      const rec = val as Record<string, unknown>;
      if (typeof rec.class_type === 'string' && rec.inputs && typeof rec.inputs === 'object') {
        for (const [k, v] of Object.entries(rec.inputs as Record<string, unknown>)) {
          if (typeof v === 'string') {
            addRef(v, rec.class_type, k);
          }
        }
      }
    }
  };

  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.nodes)) {
    for (const node of obj.nodes) {
      if (!node || typeof node !== 'object') continue;
      const rec = node as Record<string, unknown>;
      const nodeClass = typeof rec.type === 'string' ? rec.type : '';
      if (!nodeClass || !Array.isArray(rec.widgets_values)) continue;
      for (const val of rec.widgets_values) {
        if (typeof val === 'string') {
          addRef(val, nodeClass);
        }
      }
    }
  }

  inspectPromptGraph(obj);
  if (obj.prompt && typeof obj.prompt === 'object') {
    inspectPromptGraph(obj.prompt as Record<string, unknown>);
  }

  return refs;
}
