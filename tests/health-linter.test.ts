import { describe, it, expect } from 'vitest';
import { lintPythonNodeCode, autoPatchPythonCode } from '@/lib/health-linter';

describe('health-linter', () => {
  it('detects hardcoded custom_nodes import', () => {
    const code = `
import os
from custom_nodes.ComfyUI_Impact_Pack.modules import sub_logic

class MyNode:
    pass
`;
    const result = lintPythonNodeCode(code, 'test_node.py');
    expect(result.status).toBe('fragile');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].rule).toBe('hardcoded_import');
    expect(result.issues[0].patchable).toBe(true);
  });

  it('detects Windows backslash path concatenation', () => {
    const code = `
import os

model_path = base_dir + "\\\\" + "checkpoints"
`;
    const result = lintPythonNodeCode(code, 'test_path.py');
    expect(result.status).toBe('fragile');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].rule).toBe('windows_path');
  });

  it('detects absolute user paths and marks status as os_locked', () => {
    const code = `
config_file = "C:\\\\Users\\\\Developer\\\\ComfyUI\\\\config.yaml"
`;
    const result = lintPythonNodeCode(code, 'test_abs.py');
    expect(result.status).toBe('os_locked');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].rule).toBe('absolute_path');
  });

  it('reports compliant for clean cross-platform code and does not falsely flag string concatenation', () => {
    const code = `
import os
from .modules import sub_logic

checkpoint_path = os.path.join(os.path.dirname(__file__), "models")
title = "ComfyUI_" + name + "_Output"
filename = base_prefix + "_preview.png"
`;
    const result = lintPythonNodeCode(code, 'clean.py');
    expect(result.status).toBe('compliant');
    expect(result.issues).toHaveLength(0);
  });

  it('auto-patches hardcoded imports and Windows path concatenation', () => {
    const code = `from custom_nodes.ImpactPack.sub import Helper\npath = folder + "\\\\" + file`;
    const { patchedCode, changesCount } = autoPatchPythonCode(code);
    expect(changesCount).toBeGreaterThanOrEqual(1);
    expect(patchedCode).toContain('from .sub import Helper');
    expect(patchedCode).toContain('os.path.join(folder, file)');
  });
});

