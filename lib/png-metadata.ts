/**
 * PNG chunk metadata parser for ComfyUI workflows.
 * Decodes PNG tEXt and iTXt chunks to extract embedded workflow JSON.
 */

export interface ExtractedWorkflowData {
  workflowJson: Record<string, unknown> | null;
  nodeTypes: string[];
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

    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) break;

      const length =
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3];

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
