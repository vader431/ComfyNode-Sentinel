import {
  RoadmapTask,
  InstalledNode,
  WorkspaceProfile,
  EnvironmentSettings,
  PipQueueItem,
  TerminalLogEntry,
  UpdateTransaction,
} from '@/types';
import {
  INITIAL_ROADMAP_TASKS,
  INITIAL_PROFILES,
  DEFAULT_SETTINGS,
} from './default-data';

const STORAGE_KEYS = {
  TASKS: 'comfynode_tasks_v2',
  NODES: 'comfynode_installed_nodes_v2',
  TRASH: 'comfynode_trash_nodes_v2',
  PROFILES: 'comfynode_profiles_v2',
  ACTIVE_PROFILE: 'comfynode_active_profile_v2',
  SETTINGS: 'comfynode_settings_v2',
  ALIASES: 'comfynode_aliases_v2',
  LOGS: 'comfynode_terminal_logs_v2',
  PIP_QUEUE: 'comfynode_pip_queue_v2',
  TRANSACTIONS: 'comfynode_transactions_v2',
};

// Safe LocalStorage accessor
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
  getTasks: (): RoadmapTask[] => getStoredItem(STORAGE_KEYS.TASKS, INITIAL_ROADMAP_TASKS),
  setTasks: (tasks: RoadmapTask[]): void => setStoredItem(STORAGE_KEYS.TASKS, tasks),

  getNodes: (): InstalledNode[] => getStoredItem(STORAGE_KEYS.NODES, []),
  setNodes: (nodes: InstalledNode[]): void => setStoredItem(STORAGE_KEYS.NODES, nodes),

  getTrash: (): InstalledNode[] => getStoredItem(STORAGE_KEYS.TRASH, []),
  setTrash: (nodes: InstalledNode[]): void => setStoredItem(STORAGE_KEYS.TRASH, nodes),

  getProfiles: (): WorkspaceProfile[] => getStoredItem(STORAGE_KEYS.PROFILES, INITIAL_PROFILES),
  setProfiles: (profiles: WorkspaceProfile[]): void => setStoredItem(STORAGE_KEYS.PROFILES, profiles),

  getActiveProfileId: (): string => getStoredItem(STORAGE_KEYS.ACTIVE_PROFILE, 'profile-video'),
  setActiveProfileId: (id: string): void => setStoredItem(STORAGE_KEYS.ACTIVE_PROFILE, id),

  getSettings: (): EnvironmentSettings => getStoredItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
  setSettings: (settings: EnvironmentSettings): void => setStoredItem(STORAGE_KEYS.SETTINGS, settings),

  getAliases: (): Record<string, string> => {
    const fallback: Record<string, string> = {
      'comfyui_controlnet_aux_plus': 'ControlNet Preprocessors (Aux)',
      'ComfyUI_IPAdapter_plus': 'IPAdapter Plus',
      'comfyui-reactor-node': 'ReActor Face Swapper',
    };
    return getStoredItem(STORAGE_KEYS.ALIASES, fallback);
  },
  setAliases: (aliases: Record<string, string>): void => setStoredItem(STORAGE_KEYS.ALIASES, aliases),

  getLogs: (): TerminalLogEntry[] => getStoredItem(STORAGE_KEYS.LOGS, [
    {
      id: 'init-log-1',
      timestamp: '00:00:01',
      type: 'info',
      text: 'ComfyNode Sentinel initialized.',
    },
    {
      id: 'init-log-2',
      timestamp: '00:00:02',
      type: 'shield',
      text: 'Torch Shield activated: PyTorch overwrite protection active (Strict Mode).',
    },
  ]),
  setLogs: (logs: TerminalLogEntry[]): void => {
    // Keep at most 200 recent log lines to prevent localStorage exhaustion
    const capped = logs.length > 200 ? logs.slice(-200) : logs;
    setStoredItem(STORAGE_KEYS.LOGS, capped);
  },

  getPipQueue: (): PipQueueItem[] => getStoredItem(STORAGE_KEYS.PIP_QUEUE, []),
  setPipQueue: (queue: PipQueueItem[]): void => setStoredItem(STORAGE_KEYS.PIP_QUEUE, queue),

  getTransactions: (): UpdateTransaction[] =>
    getStoredItem(STORAGE_KEYS.TRANSACTIONS, []),
  setTransactions: (txs: UpdateTransaction[]): void =>
    setStoredItem(STORAGE_KEYS.TRANSACTIONS, txs),

  resetToDefaults: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.TASKS);
    localStorage.removeItem(STORAGE_KEYS.NODES);
    localStorage.removeItem(STORAGE_KEYS.TRASH);
    localStorage.removeItem(STORAGE_KEYS.PROFILES);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.ALIASES);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.PIP_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
  },
};
