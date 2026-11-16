import { describe, expect, it } from 'vitest';
import { extractModelReferencesFromJson } from '@/lib/png-metadata';

describe('workflow model extraction', () => {
  it('extracts checkpoints, loras, controlnets, and vaes from UI workflow JSON', () => {
    const workflow = {
      nodes: [
        { id: 1, type: 'CheckpointLoaderSimple', widgets_values: ['flux1-dev-fp8.safetensors'] },
        { id: 2, type: 'LoraLoader', widgets_values: ['detail_tweaker.safetensors', 0.8, 0.8] },
        { id: 3, type: 'ControlNetLoader', widgets_values: ['control_canny.pth'] },
        { id: 4, type: 'VAELoader', widgets_values: ['ae.safetensors'] },
      ],
    };

    const models = extractModelReferencesFromJson(workflow);
    expect(models).toEqual([
      { fileName: 'flux1-dev-fp8.safetensors', modelType: 'checkpoints', nodeClass: 'CheckpointLoaderSimple' },
      { fileName: 'detail_tweaker.safetensors', modelType: 'loras', nodeClass: 'LoraLoader' },
      { fileName: 'control_canny.pth', modelType: 'controlnet', nodeClass: 'ControlNetLoader' },
      { fileName: 'ae.safetensors', modelType: 'vae', nodeClass: 'VAELoader' },
    ]);
  });

  it('extracts models from API prompt JSON without duplicates', () => {
    const prompt = {
      '10': {
        class_type: 'UNETLoader',
        inputs: { unet_name: 'wan2.1_i2v_480p.safetensors', weight_dtype: 'fp8_e4m3fn' },
      },
      '11': {
        class_type: 'DualCLIPLoader',
        inputs: { clip_name1: 'umt5_xxl_fp8.safetensors', clip_name2: 'clip_l.safetensors' },
      },
      '12': {
        class_type: 'UNETLoader',
        inputs: { unet_name: 'wan2.1_i2v_480p.safetensors' },
      },
    };

    const models = extractModelReferencesFromJson(prompt);
    expect(models).toHaveLength(3);
    expect(models[0]).toMatchObject({ fileName: 'wan2.1_i2v_480p.safetensors', modelType: 'unet' });
    expect(models[1]).toMatchObject({ fileName: 'umt5_xxl_fp8.safetensors', modelType: 'clip' });
    expect(models[2]).toMatchObject({ fileName: 'clip_l.safetensors', modelType: 'clip' });
  });
});
