import { describe, expect, it } from 'vitest';
import {
  analyzeComfyLogs,
  extractCustomNodeFolderFromLine,
  resolvePipPackageName,
} from '@/lib/crash-doctor';

describe('crash-doctor', () => {
  it('maps common Python import names to pip packages', () => {
    expect(resolvePipPackageName('cv2')).toBe('opencv-python');
    expect(resolvePipPackageName('PIL.Image')).toBe('Pillow');
    expect(resolvePipPackageName('yaml')).toBe('PyYAML');
    expect(resolvePipPackageName('insightface')).toBe('insightface');
  });

  it('extracts custom node folder names from Windows and POSIX paths', () => {
    expect(
      extractCustomNodeFolderFromLine('File "C:\\AI\\ComfyUI\\custom_nodes\\ComfyUI-Impact-Pack\\__init__.py", line 12')
    ).toBe('ComfyUI-Impact-Pack');
    expect(
      extractCustomNodeFolderFromLine('0.2 seconds (IMPORT FAILED): /home/user/ComfyUI/custom_nodes/rgthree-comfy')
    ).toBe('rgthree-comfy');
  });

  it('detects ModuleNotFoundError with offending node and pip package suggestion', () => {
    const logs = [
      { type: 'stderr' as const, text: 'Traceback (most recent call last):' },
      { type: 'stderr' as const, text: '  File "C:\\ComfyUI\\custom_nodes\\ComfyUI-ReActor\\nodes.py", line 4, in <module>' },
      { type: 'stderr' as const, text: "ModuleNotFoundError: No module named 'cv2'" },
      { type: 'stderr' as const, text: '0.1 seconds (IMPORT FAILED): C:\\ComfyUI\\custom_nodes\\ComfyUI-ReActor' },
    ];

    const diagnostics = analyzeComfyLogs(logs);
    expect(diagnostics.length).toBe(2);
    expect(diagnostics[0]).toMatchObject({
      kind: 'missing_module',
      nodeFolderName: 'ComfyUI-ReActor',
      missingModule: 'cv2',
      suggestedPipPackage: 'opencv-python',
    });
    expect(diagnostics[1]).toMatchObject({
      kind: 'import_failed',
      nodeFolderName: 'ComfyUI-ReActor',
    });
  });

  it('detects CUDA out of memory errors', () => {
    const diagnostics = analyzeComfyLogs([
      { type: 'stderr', text: 'torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB' },
    ]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].kind).toBe('cuda_oom');
  });
});
