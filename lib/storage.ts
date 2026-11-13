import {
  InstalledNode,
  WorkspaceProfile,
  EnvironmentSettings,
  ComfyInstance,
  PipQueueItem,
  TerminalLogEntry,
  UpdateTransaction,
} from '@/types';
import { DEFAULT_SETTINGS } from './default-data';

const STORAGE_KEYS = {
  NODES: 'comfynode_installed_nodes_v2',
  TRASH: 'comfynode_trash_nodes_v2',
  PROFILES: 'comfynode_profiles_v2',
  ACTIVE_PROFILE: 'comfynode_active_profile_v2',
  SETTINGS: 'comfynode_settings_v2',
  ALIASES: 'comfynode_aliases_v2',
  LOGS: 'comfynode_terminal_logs_v2',
  PIP_QUEUE: 'comfynode_pip_queue_v2',
  TRANSACTIONS: 'comfynode_transactions_v2',
  INSTANCES: 'comfynode_instances_v1',
  ACTIVE_INSTANCE: 'comfynode_active_instance_v1',
};

function getStoredItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return fallback;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
}

export const StorageService = {
  getNodes: (): InstalledNode[] => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.NODES);
    }
    return [];
  },
  setNodes: (_nodes: InstalledNode[]): void => {
    // Real filesystem (custom_nodes/) is the source of truth; do not cache nodes in localStorage.
  },

  getTrash: (): InstalledNode[] => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.TRASH);
    }
    return [];
  },
  setTrash: (_nodes: InstalledNode[]): void => {
    // Real filesystem (.sentinel_trash/) is the source of truth.
  },

  getProfiles: (): WorkspaceProfile[] => getStoredItem(STORAGE_KEYS.PROFILES, []),
  setProfiles: (profiles: WorkspaceProfile[]): void => setStoredItem(STORAGE_KEYS.PROFILES, profiles),

  getActiveProfileId: (): string => getStoredItem(STORAGE_KEYS.ACTIVE_PROFILE, ''),
  setActiveProfileId: (id: string): void => setStoredItem(STORAGE_KEYS.ACTIVE_PROFILE, id),

  getSettings: (): EnvironmentSettings => getStoredItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
  setSettings: (settings: EnvironmentSettings): void => setStoredItem(STORAGE_KEYS.SETTINGS, settings),

  getAliases: (): Record<string, string> => getStoredItem(STORAGE_KEYS.ALIASES, {}),
  setAliases: (aliases: Record<string, string>): void => setStoredItem(STORAGE_KEYS.ALIASES, aliases),

  getLogs: (): TerminalLogEntry[] =>
    getStoredItem(STORAGE_KEYS.LOGS, [
      {
        id: 'init-log-1',
        timestamp: '00:00:00',
        type: 'info',
        text: 'ComfyNode Sentinel session started.',
      },
    ]),
  setLogs: (logs: TerminalLogEntry[]): void => {
    const capped = logs.length > 200 ? logs.slice(-200) : logs;
    setStoredItem(STORAGE_KEYS.LOGS, capped);
  },

  getPipQueue: (): PipQueueItem[] => {
    const raw = getStoredItem<PipQueueItem[]>(STORAGE_KEYS.PIP_QUEUE, []);
    // If an app reload interrupted an active pip command, mark it as failed rather than stuck running
    return raw.map((item) =>
      item.status === 'running'
        ? { ...item, status: 'failed' as const, finishedAt: item.finishedAt || new Date().toISOString() }
        : item
    );
  },
  setPipQueue: (queue: PipQueueItem[]): void => setStoredItem(STORAGE_KEYS.PIP_QUEUE, queue),

  getTransactions: (): UpdateTransaction[] => getStoredItem(STORAGE_KEYS.TRANSACTIONS, []),
  setTransactions: (txs: UpdateTransaction[]): void =>
    setStoredItem(STORAGE_KEYS.TRANSACTIONS, txs),

  getInstances: (): ComfyInstance[] => {
    const stored = getStoredItem<ComfyInstance[]>(STORAGE_KEYS.INSTANCES, []);
    if (stored.length > 0) return stored;
    const current = getStoredItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    if (current.comfyRoot) {
      return [
        {
          id: 'instance-default',
          name: 'Default ComfyUI',
          comfyRoot: current.comfyRoot,
          pythonBinary: current.pythonBinary,
          pythonType: current.pythonType,
          port: current.comfyPort || 8188,
        },
      ];
    }
    return [];
  },
  setInstances: (instances: ComfyInstance[]): void =>
    setStoredItem(STORAGE_KEYS.INSTANCES, instances),

  getActiveInstanceId: (): string =>
    getStoredItem(STORAGE_KEYS.ACTIVE_INSTANCE, 'instance-default'),
  setActiveInstanceId: (id: string): void =>
    setStoredItem(STORAGE_KEYS.ACTIVE_INSTANCE, id),

  resetToDefaults: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.NODES);
    localStorage.removeItem(STORAGE_KEYS.TRASH);
    localStorage.removeItem(STORAGE_KEYS.PROFILES);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.ALIASES);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.PIP_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.INSTANCES);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_INSTANCE);
  },
};
