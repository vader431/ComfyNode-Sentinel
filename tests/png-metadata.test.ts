import { describe, it, expect } from 'vitest';
import {
  extractNodeTypesFromJson,
  extractWorkflowFromBuffer,
} from '@/lib/png-metadata';

describe('png-metadata', () => {
  it('extracts class types from UI workflow format with nodes array', () => {
    const uiWorkflow = {
      nodes: [
        { id: 1, type: 'KSampler' },
        { id: 2, type: 'CheckpointLoaderSimple' },
        { id: 3, type: 'VAEDecode' },
      ],
    };
    const classes = extractNodeTypesFromJson(uiWorkflow);
    expect(classes).toEqual(['KSampler', 'CheckpointLoaderSimple', 'VAEDecode']);
  });

  it('extracts class types from API prompt format with class_type', () => {
    const apiPrompt = {
      '3': { class_type: 'KSampler' },
      '4': { class_type: 'CLIPTextEncode' },
      '5': { class_type: 'SaveImage' },
    };
    const classes = extractNodeTypesFromJson(apiPrompt);
    expect(classes).toContain('KSampler');
    expect(classes).toContain('CLIPTextEncode');
    expect(classes).toContain('SaveImage');
  });

  it('parses workflow from JSON file input', async () => {
    const jsonString = JSON.stringify({
      nodes: [{ type: 'DWPreprocessor' }, { type: 'IPAdapterApply' }],
    });
    const file = new File([jsonString], 'workflow.json', { type: 'application/json' });
    const result = await extractWorkflowFromBuffer(file);
    expect(result.sourceType).toBe('json-file');
    expect(result.nodeTypes).toEqual(['DWPreprocessor', 'IPAdapterApply']);
  });

  it('correctly reads binary PNG with tEXt workflow chunk', async () => {
    // Construct a minimal valid PNG in memory
    // 8-byte signature: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    
    // Chunk payload: "workflow\0" + JSON string
    const keyword = 'workflow\0';
    const jsonPayload = JSON.stringify({
      nodes: [{ type: 'AnimateDiffLoaderWithContext' }],
    });
    const textEncoder = new TextEncoder();
    const chunkData = textEncoder.encode(keyword + jsonPayload);
    
    // Chunk structure: 4 bytes length, 4 bytes type ('tEXt'), N bytes data, 4 bytes CRC
    const chunkLength = chunkData.length;
    const chunkType = [116, 69, 88, 116]; // 'tEXt' in ASCII
    const dummyCrc = [0, 0, 0, 0];

    const totalLength = pngSignature.length + 4 + 4 + chunkLength + 4;
    const buffer = new Uint8Array(totalLength);
    let offset = 0;

    // 1. Signature
    buffer.set(pngSignature, offset);
    offset += pngSignature.length;

    // 2. Length (big endian 32-bit uint)
    new DataView(buffer.buffer).setUint32(offset, chunkLength);
    offset += 4;

    // 3. Type
    buffer.set(chunkType, offset);
    offset += 4;

    // 4. Data
    buffer.set(chunkData, offset);
    offset += chunkLength;

    // 5. CRC
    buffer.set(dummyCrc, offset);

    const file = new File([buffer], 'comfy_generated.png', { type: 'image/png' });
    const result = await extractWorkflowFromBuffer(file);

    expect(result.sourceType).toBe('png-metadata');
    expect(result.nodeTypes).toContain('AnimateDiffLoaderWithContext');
  });
});

