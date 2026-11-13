import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '@/lib/storage';
import { DEFAULT_SETTINGS } from '@/lib/default-data';

describe('StorageService multi-instance ComfyUI management', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
      configurable: true,
    });
  });

  it('auto-seeds Default ComfyUI instance when settings.comfyRoot is configured', () => {
    StorageService.setSettings({
      ...DEFAULT_SETTINGS,
      comfyRoot: 'C:\\ComfyUI',
      pythonBinary: 'C:\\ComfyUI\\venv\\Scripts\\python.exe',
      pythonType: 'virtualenv',
      comfyPort: 8189,
    });

    const instances = StorageService.getInstances();
    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({
      id: 'instance-default',
      name: 'Default ComfyUI',
      comfyRoot: 'C:\\ComfyUI',
      port: 8189,
    });
  });

  it('persists and retrieves multiple instances and activeInstanceId', () => {
    StorageService.setInstances([
      {
        id: 'inst-1',
        name: 'Flux Studio',
        comfyRoot: '/opt/ComfyUI-Flux',
        pythonBinary: '/opt/ComfyUI-Flux/venv/bin/python',
        pythonType: 'virtualenv',
        port: 8188,
      },
      {
        id: 'inst-2',
        name: 'SDXL Portable',
        comfyRoot: 'D:\\ComfyUI_portable',
        pythonBinary: 'D:\\python_embeded\\python.exe',
        pythonType: 'windows_portable',
        port: 8190,
      },
    ]);
    StorageService.setActiveInstanceId('inst-2');

    expect(StorageService.getInstances()).toHaveLength(2);
    expect(StorageService.getActiveInstanceId()).toBe('inst-2');
  });
});

