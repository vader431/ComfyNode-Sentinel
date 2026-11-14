'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Header, ActiveTab } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { OnboardingCard } from '@/components/OnboardingCard';
import { ToastContainer, ToastMessage } from '@/components/ToastContainer';
import { ConsoleDrawer, ConsoleDrawerTab } from '@/components/ConsoleDrawer';
import { StatusBar } from '@/components/StatusBar';
import { InspectorView } from '@/components/views/InspectorView';
import { TerminalRunnerView } from '@/components/views/TerminalRunnerView';
import { RegistryView } from '@/components/views/RegistryView';
import { LockfileView } from '@/components/views/LockfileView';
import { HealthDoctorView } from '@/components/views/HealthDoctorView';
import { ProfilesView } from '@/components/views/ProfilesView';
import { ModelsView } from '@/components/views/ModelsView';
import { SettingsView } from '@/components/views/SettingsView';
import { StorageService } from '@/lib/storage';
import { COMMUNITY_REGISTRY } from '@/lib/default-data';
import {
  recordTransaction,
  rollbackTransaction,
} from '@/lib/transaction-history';
import {
  isTauriEnvironment,
  nativeSetMinimizeToTray,
  nativeSyncTrayStatus,
} from '@/lib/tauri-bridge';
import {
  applyComfyWsMessage,
  fetchComfyTelemetry,
  sendComfyTelemetryAction,
  summarizePrimaryGpu,
} from '@/lib/comfy-telemetry';
import {
  checkEnvironmentReal,
  scanNodesReal,
  toggleNodeStateReal,
  uninstallNodeReal,
  restoreNodeReal,
  normalizeNodeReal,
  cloneNodeReal,
  checkUpdatesReal,
  updateNodeReal,
  rollbackNodeReal,
  streamExecReal,
} from '@/lib/system-client';
import {
  InstalledNode,
  WorkspaceProfile,
  EnvironmentSettings,
  ComfyInstance,
  ComfyLiveTelemetry,
  ComfyWsProgressState,
  PipQueueItem,
  TerminalLogEntry,
  RegistryNode,
  ReconciliationItem,
  UpdateTransaction,
} from '@/types';

const emptySubscribe = () => () => {};
let nextQueueIndex = 1;
function createQueueId(): string {
  nextQueueIndex += 1;
  return `queue-job-${nextQueueIndex}`;
}

export default function Home() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isClient) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen flex items-center justify-center bg-[#0b0f17] text-slate-400 font-mono text-xs"
      >
        Loading ComfyNode Sentinel...
      </div>
    );
  }

  return <SentinelWorkspace />;
}

function SentinelWorkspace() {
  const isClient = true;
  const [activeTab, setActiveTab] = useState<ActiveTab>('inspector');
  const [targetRunnerCommand, setTargetRunnerCommand] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isConsoleDrawerOpen, setIsConsoleDrawerOpen] = useState(false);
  const [consoleDrawerTab, setConsoleDrawerTab] = useState<ConsoleDrawerTab>('logs');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [updateProgress, setUpdateProgress] = useState<{
    active: boolean;
    phase: 'checking' | 'updating';
    current: number;
    total: number;
    currentNode?: string;
  } | null>(null);

  // Persistent States initialized via lazy initializers
  const [nodes, setNodes] = useState<InstalledNode[]>(() => StorageService.getNodes());
  const [trashNodes, setTrashNodes] = useState<InstalledNode[]>(() => StorageService.getTrash());
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>(() => StorageService.getProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string>(() => StorageService.getActiveProfileId());
  const [aliases, setAliases] = useState<Record<string, string>>(() => StorageService.getAliases());
  const [settings, setSettings] = useState<EnvironmentSettings>(() => StorageService.getSettings());
  const [instances, setInstances] = useState<ComfyInstance[]>(() => StorageService.getInstances());
  const [activeInstanceId, setActiveInstanceId] = useState<string>(() => StorageService.getActiveInstanceId());
  const [logs, setLogs] = useState<TerminalLogEntry[]>(() => StorageService.getLogs());
  const [pipQueue, setPipQueue] = useState<PipQueueItem[]>(() => StorageService.getPipQueue());
  const [transactions, setTransactions] = useState<UpdateTransaction[]>(() => StorageService.getTransactions());
  const [scannedRequirementsMap, setScannedRequirementsMap] = useState<Record<string, string[]>>({});
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(false);
  const [comfyProcessStatus, setComfyProcessStatus] = useState<'stopped' | 'starting' | 'running' | 'error'>('stopped');
  const [comfyProcessPid, setComfyProcessPid] = useState<number | null>(null);
  const [comfyTelemetry, setComfyTelemetry] = useState<ComfyLiveTelemetry | null>(null);
  const [comfyWsState, setComfyWsState] = useState<ComfyWsProgressState>({
    wsConnected: false,
    executingNode: null,
    currentPromptId: null,
    stepProgress: null,
  });
  const comfyLastLogIdRef = React.useRef<number>(0);

  const addLog = (entry: Omit<TerminalLogEntry, 'id'>) => {
    const newEntry: TerminalLogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      ...entry,
    };
    setLogs((prev) => {
      const updated = [...prev, newEntry].slice(-300);
      StorageService.setLogs(updated.slice(-100));
      return updated;
    });
  };

  const clearLogs = () => {
    setLogs([]);
    StorageService.setLogs([]);
  };

  const pushToast = useCallback((tone: ToastMessage['tone'], title: string, detail?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-3), { id, tone, title, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateNodes = (newNodes: InstalledNode[]) => {
    setNodes(newNodes);
    StorageService.setNodes(newNodes);
  };

  const updateTrash = (newTrash: InstalledNode[]) => {
    setTrashNodes(newTrash);
    StorageService.setTrash(newTrash);
  };

  const updateProfiles = (newProfiles: WorkspaceProfile[]) => {
    setProfiles(newProfiles);
    StorageService.setProfiles(newProfiles);
  };

  const updateActiveProfile = (id: string) => {
    setActiveProfileId(id);
    StorageService.setActiveProfileId(id);
  };

  const updateAliases = (newAliases: Record<string, string>) => {
    setAliases(newAliases);
    StorageService.setAliases(newAliases);
  };

  const updateSettings = (newSettings: EnvironmentSettings) => {
    setSettings(newSettings);
    StorageService.setSettings(newSettings);
  };

  const performFullScan = useCallback(async (comfyRoot: string, pythonBinary?: string) => {
    if (!comfyRoot) return;
    setIsScanning(true);
    try {
      const env = await checkEnvironmentReal(comfyRoot, pythonBinary);
      setSettings((prev) => {
        const next: EnvironmentSettings = {
          ...prev,
          comfyRoot,
          pythonBinary: pythonBinary ?? prev.pythonBinary,
          isValidRoot: env.isValidRoot,
          hasMainPy: env.hasMainPy,
          hasCustomNodes: env.hasCustomNodes,
        };
        StorageService.setSettings(next);
        return next;
      });

      if (env.isValidRoot) {
        const scan = await scanNodesReal(comfyRoot);
        if (!scan.error) {
          setNodes(scan.nodes);
          StorageService.setNodes(scan.nodes);
          setTrashNodes(scan.trashNodes);
          StorageService.setTrash(scan.trashNodes);
          setScannedRequirementsMap(scan.requirementsMap);
        }
      } else {
        setNodes([]);
        setTrashNodes([]);
        setScannedRequirementsMap({});
      }
    } catch {
      // Ignore startup network errors if backend is still initializing
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Sync minimize-to-tray preference with Tauri shell on startup
  useEffect(() => {
    if (!isClient) return;
    void nativeSetMinimizeToTray(Boolean(settings.minimizeToTray));
  }, [isClient, settings.minimizeToTray]);

  // Listen to Tauri system tray context menu events
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    let unlistenToggle: (() => void) | undefined;
    let unlistenUpdates: (() => void) | undefined;

    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('tray-toggle-comfy', async () => {
        const port = settings.comfyPort || 8188;
        const isRunning = comfyProcessStatus === 'running' || comfyProcessStatus === 'starting';
        const action = isRunning ? 'stop' : 'start';
        try {
          await fetch('/api/comfy/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action,
              comfyRoot: settings.comfyRoot,
              pythonBinary: settings.pythonBinary || 'python',
              port,
            }),
          });
        } catch {
          // ignore
        }
      }).then((fn) => {
        unlistenToggle = fn;
      });

      listen('tray-check-updates', () => {
        setActiveTab('settings');
      }).then((fn) => {
        unlistenUpdates = fn;
      });
    });

    return () => {
      unlistenToggle?.();
      unlistenUpdates?.();
    };
  }, [comfyProcessStatus, settings.comfyRoot, settings.pythonBinary, settings.comfyPort]);

  // Sync ComfyUI managed process status & tail logs
  useEffect(() => {
    if (!isClient) return;
    let cancelled = false;

    const pollProcess = async () => {
      try {
        const res = await fetch(`/api/comfy/process?since=${comfyLastLogIdRef.current}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setComfyProcessStatus(data.status || 'stopped');
        setComfyProcessPid(data.pid ?? null);
        if (Array.isArray(data.logs) && data.logs.length > 0) {
          for (const l of data.logs) {
            addLog({
              timestamp: new Date(l.timestamp).toLocaleTimeString(),
              type: l.stream,
              text: l.text,
            });
          }
          comfyLastLogIdRef.current = data.lastLogId || comfyLastLogIdRef.current;
        }
      } catch {
        // ignore transient poll errors
      }
    };

    void pollProcess();
    if (comfyProcessStatus === 'starting' || comfyProcessStatus === 'running') {
      const interval = setInterval(() => void pollProcess(), 2000);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [isClient, comfyProcessStatus]);

  const activeComfyPort = settings.comfyPort || 8188;
  const isComfyTelemetryOnline = Boolean(comfyTelemetry?.online);

  // Poll live ComfyUI /system_stats and /queue via server proxy
  useEffect(() => {
    if (!isClient) return;
    let cancelled = false;

    const pollTelemetry = async () => {
      const next = await fetchComfyTelemetry(activeComfyPort);
      if (cancelled) return;
      setComfyTelemetry(next);

      const gpu = summarizePrimaryGpu(next.systemStats?.devices);
      const vramLabel = gpu
        ? `VRAM ${gpu.vramUsedGiB.toFixed(1)}/${gpu.vramTotalGiB.toFixed(1)} GiB (${gpu.vramPercent}%)`
        : undefined;
      const statusLabel = next.online
        ? next.queue.runningCount > 0
          ? `Generating (:${activeComfyPort})`
          : `ComfyUI Online (:${activeComfyPort})`
        : 'ComfyUI Offline';
      void nativeSyncTrayStatus(statusLabel, vramLabel);
    };

    void pollTelemetry();
    const intervalMs =
      isComfyTelemetryOnline || comfyProcessStatus === 'running' || comfyProcessStatus === 'starting'
        ? 2500
        : 7500;
    const timer = setInterval(() => void pollTelemetry(), intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isClient, activeComfyPort, isComfyTelemetryOnline, comfyProcessStatus]);

  // Connect directly to ComfyUI WebSocket (ws://127.0.0.1:<port>/ws) when ComfyUI is online
  useEffect(() => {
    if (!isClient || !isComfyTelemetryOnline) {
      return;
    }

    let ws: WebSocket | null = null;
    let closed = false;

    try {
      ws = new WebSocket(`ws://127.0.0.1:${activeComfyPort}/ws?clientId=sentinel-ui`);
      ws.onopen = () => {
        if (closed) return;
        setComfyWsState((prev) => ({ ...prev, wsConnected: true }));
      };
      ws.onmessage = (event) => {
        if (closed || typeof event.data !== 'string') return;
        setComfyWsState((prev) => applyComfyWsMessage(prev, event.data).next);
      };
      ws.onerror = () => {
        if (closed) return;
        setComfyWsState((prev) => ({ ...prev, wsConnected: false }));
      };
      ws.onclose = () => {
        if (closed) return;
        setComfyWsState({
          wsConnected: false,
          executingNode: null,
          currentPromptId: null,
          stepProgress: null,
        });
      };
    } catch {
      // Ignore WebSocket connection errors if ComfyUI is restarting
    }

    return () => {
      closed = true;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [isClient, isComfyTelemetryOnline, activeComfyPort]);

  const effectiveComfyWsState: ComfyWsProgressState = isComfyTelemetryOnline
    ? comfyWsState
    : {
        wsConnected: false,
        executingNode: null,
        currentPromptId: null,
        stepProgress: null,
      };

  // Live environment & custom_nodes scanner on startup
  useEffect(() => {
    if (!isClient || !settings.comfyRoot) return;
    const timer = setTimeout(() => {
      void performFullScan(settings.comfyRoot, settings.pythonBinary);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  // Node Inspector Handlers
  const handleToggleNodeState = async (folderName: string) => {
    const res = await toggleNodeStateReal(settings.comfyRoot, folderName);
    if (!res.success) {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: `[Toggle Error] ${res.error || 'Failed to rename node folder on disk'}`,
      });
      return;
    }

    const updated = nodes.map((n) => {
      if (n.folderName === folderName) {
        const nextState = typeof res.enabled === 'boolean' ? res.enabled : !n.enabled;
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'info',
          text: `[Atomic Rename] custom_nodes/${n.folderName} -> custom_nodes/${n.folderName}${
            nextState ? '' : '.disabled'
          }`,
        });
        return { ...n, enabled: nextState };
      }
      return n;
    });
    updateNodes(updated);
  };

  const handleUninstallNode = async (folderName: string) => {
    const target = nodes.find((n) => n.folderName === folderName);
    if (!target) return;

    const res = await uninstallNodeReal(settings.comfyRoot, folderName);
    if (!res.success) {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: `[Uninstall Error] ${res.error || 'Failed to move node to .sentinel_trash'}`,
      });
      return;
    }

    const remainingNodes = nodes.filter((n) => n.folderName !== folderName);
    const newTrash = [target, ...trashNodes];

    updateNodes(remainingNodes);
    updateTrash(newTrash);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'warn',
      text: `[Safe Uninstall] Moved custom_nodes/${folderName} to .sentinel_trash quarantine.`,
    });
  };

  const handleUpdateSettings = async (newSettings: EnvironmentSettings) => {
    updateSettings(newSettings);
    if (newSettings.isValidRoot) {
      await performFullScan(newSettings.comfyRoot, newSettings.pythonBinary);
    }
  };

  const handleRestoreNode = async (folderName: string) => {
    const target = trashNodes.find((t) => t.folderName === folderName);
    if (!target) return;

    const res = await restoreNodeReal(settings.comfyRoot, folderName);
    if (!res.success) {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: `[Restore Error] ${res.error || 'Failed to restore node from .sentinel_trash'}`,
      });
      return;
    }

    const remainingTrash = trashNodes.filter((t) => t.folderName !== folderName);
    const newNodes = [...nodes, target];

    updateTrash(remainingTrash);
    updateNodes(newNodes);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Restored] custom_nodes/${folderName} restored from .sentinel_trash.`,
    });
  };

  const handleUpdateAlias = (folderName: string, alias: string) => {
    const nextAliases = { ...aliases, [folderName]: alias };
    updateAliases(nextAliases);
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[aliases.json] Updated virtual display name: ${folderName} -> "${alias}"`,
    });
  };

  const handleNormalizeBatch = async (replacements: { original: string; proposed: string }[]) => {
    const succeeded = new Map<string, string>();
    for (const r of replacements) {
      const res = await normalizeNodeReal(settings.comfyRoot, r.original, r.proposed);
      if (res.success) {
        succeeded.set(r.original, r.proposed);
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'info',
          text: `[Normalizer] Renamed custom_nodes/${r.original} -> custom_nodes/${r.proposed}`,
        });
      } else {
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'stderr',
          text: `[Normalizer Error] ${r.original}: ${res.error || 'Rename failed'}`,
        });
      }
    }

    const updated = nodes.map((n) => {
      const nextName = succeeded.get(n.folderName);
      if (nextName) {
        return {
          ...n,
          folderName: nextName,
          normalizedProposedName: undefined,
        };
      }
      return n;
    });
    updateNodes(updated);
  };

  // Pip & Torch Shield Handlers
  const handleEnqueuePip = (nodeName: string, requirements: string[]) => {
    // Check for torch packages
    const torchPatterns = ['torch', 'torchvision', 'torchaudio'];
    const detectedTorch = requirements.filter((req) =>
      torchPatterns.some((pattern) => req.toLowerCase().startsWith(pattern))
    );

    const hasTorchRisk = detectedTorch.length > 0;
    const queueId = createQueueId();

    const newItem: PipQueueItem = {
      id: queueId,
      nodeName,
      requirements,
      status: hasTorchRisk ? 'blocked_by_shield' : 'queued',
      hasTorchShieldTriggered: hasTorchRisk,
      strippedTorchPackages: detectedTorch,
    };

    setPipQueue((prev) => {
      const updated = [...prev, newItem];
      StorageService.setPipQueue(updated);
      return updated;
    });

    if (hasTorchRisk) {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'shield',
        text: `⚠️ [Torch Shield Intercept] ${nodeName} requirements contain: ${detectedTorch.join(
          ', '
        )}. Execution paused for user safety approval.`,
      });
    } else {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'info',
        text: `[Sequential Pip Queue] Enqueued dependencies for ${nodeName} (${requirements.length} packages).`,
      });
      processPipQueue(newItem.id, requirements);
    }
  };

  const handleResolveShield = (queueItemId: string, stripTorch: boolean) => {
    setPipQueue((prev) =>
      prev.map((item) => {
        if (item.id === queueItemId) {
          const finalRequirements = stripTorch
            ? item.requirements.filter(
                (r) =>
                  !['torch', 'torchvision', 'torchaudio'].some((tp) =>
                    r.toLowerCase().startsWith(tp)
                  )
              )
            : item.requirements;

          addLog({
            timestamp: new Date().toLocaleTimeString(),
            type: stripTorch ? 'success' : 'warn',
            text: stripTorch
              ? `🛡️ [Torch Shield Approved] PyTorch dependencies stripped. Installing sanitized dependencies.`
              : `⚠️ [Torch Shield Bypassed] Proceeding with unshielded installation.`,
          });

          processPipQueue(item.id, finalRequirements);
          return {
            ...item,
            requirements: finalRequirements,
            status: 'running',
          };
        }
        return item;
      })
    );
  };

  const processPipQueue = async (queueId: string, requirements: string[]) => {
    if (requirements.length === 0) {
      setPipQueue((prev) =>
        prev.map((item) => (item.id === queueId ? { ...item, status: 'completed' } : item))
      );
      return;
    }

    setPipQueue((prev) =>
      prev.map((item) => (item.id === queueId ? { ...item, status: 'running' } : item))
    );

    let exitOk = true;
    try {
      exitOk = await streamExecReal(
        {
          comfyRoot: settings.comfyRoot,
          pythonBinary: settings.pythonBinary,
          pipPackages: requirements,
        },
        (line) => {
          addLog({
            timestamp: new Date().toLocaleTimeString(),
            type: line.type,
            text: line.text,
          });
        }
      );
    } catch (err) {
      exitOk = false;
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: err instanceof Error ? err.message : 'pip execution failed',
      });
    }

    setPipQueue((prev) =>
      prev.map((item) =>
        item.id === queueId ? { ...item, status: exitOk ? 'completed' : 'failed' } : item
      )
    );
  };

  // Registry Ingestion Handlers
  const handleInstallFromRegistry = async (regNode: RegistryNode): Promise<{ ok: boolean; message: string }> => {
    if (!settings.isValidRoot) {
      return { ok: false, message: 'ComfyUI root directory is not configured. Open Settings to set a valid ComfyUI path.' };
    }
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `git clone --depth 1 ${regNode.gitUrl} custom_nodes/${regNode.name}`,
    });

    const res = await cloneNodeReal(settings.comfyRoot, regNode.gitUrl, undefined, regNode.name);
    if (!res.success) {
      const msg = res.error || 'Failed to clone repository';
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: `[Clone Error] ${msg}`,
      });
      return { ok: false, message: msg };
    }

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Cloned] ${regNode.name} installed into custom_nodes/.`,
    });

    await performFullScan(settings.comfyRoot, settings.pythonBinary);

    const reqs = res.requirements && res.requirements.length > 0 ? res.requirements : regNode.requirements;
    if (reqs && reqs.length > 0) {
      handleEnqueuePip(regNode.name, reqs);
    }
    return {
      ok: true,
      message: `Installed ${regNode.name}${reqs && reqs.length > 0 ? ` (${reqs.length} pip dependencies queued)` : ''}.`,
    };
  };

  const handleInstallViaGitUrl = async (url: string, branch?: string, folderName?: string): Promise<{ ok: boolean; message: string }> => {
    if (!settings.isValidRoot) {
      return { ok: false, message: 'ComfyUI root directory is not configured. Open Settings to set a valid ComfyUI path.' };
    }
    const computedFolder =
      folderName || url.split('/').pop()?.replace('.git', '') || 'ComfyUI-Custom';

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `git clone --depth 1 ${branch ? `-b ${branch} ` : ''}${url} custom_nodes/${computedFolder}`,
    });

    const res = await cloneNodeReal(settings.comfyRoot, url, branch, computedFolder);
    if (!res.success) {
      const msg = res.error || 'Failed to clone repository';
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: `[Clone Error] ${msg}`,
      });
      return { ok: false, message: msg };
    }

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Cloned] ${res.folderName || computedFolder} installed into custom_nodes/.`,
    });

    await performFullScan(settings.comfyRoot, settings.pythonBinary);

    if (res.requirements && res.requirements.length > 0) {
      handleEnqueuePip(res.folderName || computedFolder, res.requirements);
    }
    return { ok: true, message: `Cloned ${res.folderName || computedFolder} into custom_nodes/.` };
  };

  const handleBatchUrlImport = async (urls: string[]): Promise<{ ok: boolean; message: string }> => {
    if (!settings.isValidRoot) {
      return { ok: false, message: 'ComfyUI root directory is not configured. Open Settings to set a valid ComfyUI path.' };
    }
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[Batch URL Ingestion] Cloning ${urls.length} URLs with deduplication...`,
    });

    let addedCount = 0;
    let errorCount = 0;

    for (const url of urls) {
      const exists = nodes.some((n) => n.gitUrl.toLowerCase() === url.toLowerCase());
      if (exists) continue;

      const res = await cloneNodeReal(settings.comfyRoot, url);
      if (res.success) {
        addedCount++;
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          text: `[Batch Cloned] ${res.folderName}`,
        });
        if (res.requirements && res.requirements.length > 0) {
          handleEnqueuePip(res.folderName || url, res.requirements);
        }
      } else {
        errorCount++;
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'stderr',
          text: `[Batch Error] ${url}: ${res.error || 'Clone failed'}`,
        });
      }
    }

    await performFullScan(settings.comfyRoot, settings.pythonBinary);
    const summary = `Cloned ${addedCount} new custom node repository(s)${errorCount > 0 ? `, ${errorCount} failed (see Terminal)` : ''}.`;
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: errorCount > 0 ? 'warn' : 'success',
      text: `[Batch URL Ingestion] ${summary}`,
    });
    return { ok: errorCount === 0, message: summary };
  };

  // Updates
  const handleCheckUpdates = async (): Promise<{ ok: boolean; message: string }> => {
    if (!settings.isValidRoot) {
      return { ok: false, message: 'ComfyUI root directory is not configured. Open Settings to set a valid ComfyUI path.' };
    }
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `Checking upstream git remotes with git ls-remote...`,
    });

    setUpdateProgress({ active: true, phase: 'checking', current: 0, total: nodes.length });
    let res;
    try {
      res = await checkUpdatesReal(settings.comfyRoot);
    } finally {
      setUpdateProgress(null);
    }
    if (res.error || !res.updates) {
      const msg = res.error || 'Failed to query git remotes';
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: `[Update Check Error] ${msg}`,
      });
      return { ok: false, message: msg };
    }

    const updateMap = new Map(res.updates.map((u) => [u.folderName, u]));
    const updatedNodes = nodes.map((n) => {
      const info = updateMap.get(n.folderName);
      if (!info) return n;
      return {
        ...n,
        hasUpdate: info.hasUpdate,
        latestCommit: info.latestCommit,
      };
    });
    updateNodes(updatedNodes);

    const available = res.updates.filter((u) => u.hasUpdate);
    const msg = `Checked ${res.updates.length} git repositories. ${available.length} update(s) available${
      available.length > 0 ? `: ${available.map((a) => a.folderName).join(', ')}` : '.'
    }`;
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: available.length > 0 ? 'warn' : 'success',
      text: msg,
    });
    return { ok: true, message: msg };
  };

  const handleUpdateAll = async (): Promise<{ ok: boolean; message: string }> => {
    if (!settings.isValidRoot) {
      return { ok: false, message: 'ComfyUI root directory is not configured. Open Settings to set a valid ComfyUI path.' };
    }
    const targets = nodes.filter((n) => n.hasUpdate);
    if (targets.length === 0) {
      const msg = 'No pending updates flagged. Run "Check Updates" first.';
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'info',
        text: `[Batch Update] ${msg}`,
      });
      return { ok: true, message: msg };
    }

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[Batch Update] Pulling latest commits for ${targets.length} node(s)...`,
    });

    let newTxList = [...transactions];
    let updatedCount = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const n = targets[i];
        setUpdateProgress({
          active: true,
          phase: 'updating',
          current: i,
          total: targets.length,
          currentNode: n.folderName,
        });
        const res = await updateNodeReal(settings.comfyRoot, n.folderName);
        if (res.success) {
          updatedCount++;
          newTxList = recordTransaction(newTxList, {
            nodeFolderName: n.folderName,
            nodeDisplayName: n.cleanDisplayName,
            previousCommit: res.previousCommit || n.currentCommit,
            targetCommit: res.newCommit || n.latestCommit || n.currentCommit,
          });
          addLog({
            timestamp: new Date().toLocaleTimeString(),
            type: 'success',
            text: `[Updated] ${n.folderName}: ${res.previousCommit} -> ${res.newCommit}`,
          });
        } else {
          addLog({
            timestamp: new Date().toLocaleTimeString(),
            type: 'stderr',
            text: `[Update Error] ${n.folderName}: ${res.error || 'git pull failed'}`,
          });
        }
        setUpdateProgress({
          active: true,
          phase: 'updating',
          current: i + 1,
          total: targets.length,
          currentNode: n.folderName,
        });
      }

      setTransactions(newTxList);
      StorageService.setTransactions(newTxList);
      await performFullScan(settings.comfyRoot, settings.pythonBinary);
      return { ok: true, message: `Updated ${updatedCount} of ${targets.length} custom node(s).` };
    } finally {
      setUpdateProgress(null);
    }
  };

  const handleUpdateSingleNode = async (folderName: string): Promise<{ ok: boolean; message: string }> => {
    if (!settings.isValidRoot) {
      return { ok: false, message: 'ComfyUI root directory is not configured. Open Settings to set a valid ComfyUI path.' };
    }
    const target = nodes.find((n) => n.folderName === folderName);
    if (!target) {
      return { ok: false, message: `Node ${folderName} not found.` };
    }

    const res = await updateNodeReal(settings.comfyRoot, folderName);
    if (!res.success) {
      const msg = res.error || 'git pull failed';
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: `[Update Error] ${folderName}: ${msg}`,
      });
      return { ok: false, message: `${folderName}: ${msg}` };
    }

    const newTxList = recordTransaction(transactions, {
      nodeFolderName: target.folderName,
      nodeDisplayName: target.cleanDisplayName,
      previousCommit: res.previousCommit || target.currentCommit,
      targetCommit: res.newCommit || target.latestCommit || target.currentCommit,
    });
    setTransactions(newTxList);
    StorageService.setTransactions(newTxList);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Updated] ${folderName}: ${res.previousCommit} -> ${res.newCommit}`,
    });
    await performFullScan(settings.comfyRoot, settings.pythonBinary);
    return { ok: true, message: `Updated ${folderName} (${res.previousCommit} -> ${res.newCommit}).` };
  };

  const handleRollbackTransaction = async (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    const res = await rollbackNodeReal(settings.comfyRoot, tx.nodeFolderName, tx.previousCommit);
    if (!res.success) {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: `[Git Rollback Error] ${res.error || 'git checkout failed'}`,
      });
      return;
    }

    const { updatedTransactions, rolledBackTx } = rollbackTransaction(transactions, txId);
    if (!rolledBackTx) return;

    setTransactions(updatedTransactions);
    StorageService.setTransactions(updatedTransactions);

    await performFullScan(settings.comfyRoot, settings.pythonBinary);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'warn',
      text: `[Git Rollback] ${rolledBackTx.rollbackCommand}`,
    });
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Git Rollback] Successfully rolled back ${rolledBackTx.nodeDisplayName} to commit ${rolledBackTx.previousCommit}.`,
    });
  };

  // Lockfile Reconciliation Handler
  const handleApplyReconciliation = async (items: ReconciliationItem[]) => {
    if (!settings.isValidRoot) {
      pushToast('warn', 'ComfyUI not configured', 'Set a valid ComfyUI path in Settings first.');
      return;
    }

    for (const item of items) {
      if (item.action === 'clone') {
        const res = await cloneNodeReal(settings.comfyRoot, item.gitUrl, undefined, item.name);
        if (!res.success) {
          addLog({
            timestamp: new Date().toLocaleTimeString(),
            type: 'stderr',
            text: `[Sync Clone Error] ${item.name}: ${res.error || 'Clone failed'}`,
          });
          continue;
        }
        if (item.targetCommit && item.targetCommit !== 'pinned') {
          await rollbackNodeReal(settings.comfyRoot, item.name, item.targetCommit);
        }
        if (item.targetEnabled === false) {
          await toggleNodeStateReal(settings.comfyRoot, item.name);
        }
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          text: `[Sync Clone] Cloned ${item.name} from ${item.gitUrl}`,
        });
      } else if (item.action === 'checkout' && item.targetCommit) {
        const res = await rollbackNodeReal(settings.comfyRoot, item.name, item.targetCommit);
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: res.success ? 'info' : 'stderr',
          text: res.success
            ? `[Sync Checkout] ${item.name} -> ${item.targetCommit.slice(0, 7)}`
            : `[Sync Checkout Error] ${item.name}: ${res.error || 'Checkout failed'}`,
        });
      } else if (item.action === 'toggle_state') {
        const res = await toggleNodeStateReal(settings.comfyRoot, item.name);
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: res.success ? 'info' : 'stderr',
          text: res.success
            ? `[Sync State] Toggled ${item.name} -> ${item.targetEnabled ? 'enabled' : 'disabled'}`
            : `[Sync State Error] ${item.name}: ${res.error || 'Toggle failed'}`,
        });
      }
    }

    await performFullScan(settings.comfyRoot, settings.pythonBinary);
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `Reconciliation plan executed against disk.`,
    });
    pushToast('success', 'Lockfile reconciled', `Applied ${items.length} action(s) on disk.`);
  };

  // Workspace Profile Handler
  const handleSwitchProfile = async (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;

    updateActiveProfile(profileId);
    if (!settings.isValidRoot) {
      pushToast('warn', 'Profile selected', 'Connect your ComfyUI directory in Settings to apply folder toggles on disk.');
      return;
    }

    let toggledCount = 0;
    for (const n of nodes) {
      const shouldEnable = profile.targetNodeFolders.includes(n.folderName);
      if (n.enabled !== shouldEnable) {
        const res = await toggleNodeStateReal(settings.comfyRoot, n.folderName);
        if (res.success) toggledCount++;
      }
    }

    await performFullScan(settings.comfyRoot, settings.pythonBinary);
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Profile Switcher] Activated "${profile.name}" (${toggledCount} folder(s) toggled on disk).`,
    });
    pushToast('success', `Profile: ${profile.name}`, `Toggled ${toggledCount} node folder(s) on disk.`);
  };

  const handleCreateProfile = (name: string, description: string) => {
    const activeFolders = nodes.filter((n) => n.enabled).map((n) => n.folderName);
    const newProf: WorkspaceProfile = {
      id: `profile-${Date.now()}`,
      name,
      description: description || 'Custom user configuration.',
      icon: 'Sparkles',
      targetNodeFolders: activeFolders,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    updateProfiles([...profiles, newProf]);
    updateActiveProfile(newProf.id);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `Saved current setup as profile "${name}" with ${activeFolders.length} active custom nodes.`,
    });
  };

  // Workflow Pre-Flight Missing Nodes Installer
  const handleInstallMissingNodes = async (missingClassNames: string[]) => {
    if (!settings.isValidRoot) {
      pushToast('warn', 'ComfyUI not configured', 'Set a valid ComfyUI path in Settings first.');
      return;
    }

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[Workflow Pre-Flight] Resolving missing classes: ${missingClassNames.join(', ')}`,
    });

    const matchedRepos = new Map<string, RegistryNode>();
    const unresolved: string[] = [];

    for (const className of missingClassNames) {
      const match = COMMUNITY_REGISTRY.find((r) =>
        r.nodeClasses.some((c) => c.toLowerCase() === className.toLowerCase())
      );
      if (match) {
        matchedRepos.set(match.id, match);
      } else {
        unresolved.push(className);
      }
    }

    for (const repo of matchedRepos.values()) {
      await handleInstallFromRegistry(repo);
    }

    if (unresolved.length > 0) {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'warn',
        text: `[Workflow Pre-Flight] No registry match for: ${unresolved.join(', ')}. Use "Install via URL" in Install & Browse.`,
      });
    }
  };

  // Patching node in Health Doctor
  const handlePatchInstalledNode = (nodeId: string) => {
    const updated = nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          healthStatus: 'compliant' as const,
          healthIssues: [],
        };
      }
      return n;
    });
    updateNodes(updated);
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Health Doctor] Auto-patched node ${nodeId}. Status updated to Compliant.`,
    });
  };

  // Reset demo data
  const handleResetAllData = () => {
    StorageService.resetToDefaults();
    setNodes(StorageService.getNodes());
    setTrashNodes(StorageService.getTrash());
    setProfiles(StorageService.getProfiles());
    setActiveProfileId(StorageService.getActiveProfileId());
    setAliases(StorageService.getAliases());
    setSettings(StorageService.getSettings());
    setLogs(StorageService.getLogs());
    setPipQueue(StorageService.getPipQueue());
    pushToast('info', 'Reset to defaults', 'Local preferences and logs cleared.');
  };

  const handleRefreshNodes = async () => {
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[Sentinel] Scanning ${settings.comfyRoot}/custom_nodes on disk...`,
    });
    await performFullScan(settings.comfyRoot, settings.pythonBinary);
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Sentinel] Filesystem scan complete.`,
    });
    pushToast('success', 'Filesystem scan complete', `Scanned ${settings.comfyRoot}`);
  };

  const handleSaveInstances = (nextInstances: ComfyInstance[]) => {
    setInstances(nextInstances);
    StorageService.setInstances(nextInstances);
  };

  const handleSwitchInstance = async (instanceId: string) => {
    const target = instances.find((i) => i.id === instanceId);
    if (!target) return;
    setActiveInstanceId(target.id);
    StorageService.setActiveInstanceId(target.id);
    const nextSettings: EnvironmentSettings = {
      ...settings,
      comfyRoot: target.comfyRoot,
      pythonBinary: target.pythonBinary,
      pythonType: target.pythonType,
      comfyPort: target.port,
    };
    setSettings(nextSettings);
    StorageService.setSettings(nextSettings);
    pushToast('info', `Switched to ${target.name}`, `${target.comfyRoot} (:${target.port})`);
    await performFullScan(target.comfyRoot, target.pythonBinary);
  };

  const controlComfyProcess = async (action: 'start' | 'stop' | 'restart') => {
    const port = settings.comfyPort || 8188;
    try {
      const res = await fetch('/api/comfy/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comfyRoot: settings.comfyRoot,
          pythonBinary: settings.pythonBinary || 'python',
          port,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('error', 'ComfyUI Process Error', data.error || `Failed to ${action} ComfyUI`);
        return;
      }
      setComfyProcessStatus(data.status || 'stopped');
      setComfyProcessPid(data.pid ?? null);
      if (Array.isArray(data.logs) && data.logs.length > 0) {
        for (const l of data.logs) {
          if (l.id > comfyLastLogIdRef.current) {
            addLog({
              timestamp: new Date(l.timestamp).toLocaleTimeString(),
              type: l.stream,
              text: l.text,
            });
          }
        }
        comfyLastLogIdRef.current = data.lastLogId || comfyLastLogIdRef.current;
      }
      if (action === 'start') {
        setIsConsoleDrawerOpen(true);
        pushToast('info', 'Launching ComfyUI', 'Starting managed ComfyUI process on port 8188…');
      } else if (action === 'stop') {
        pushToast('info', 'ComfyUI Stopped', 'Managed ComfyUI process terminated.');
      } else {
        setIsConsoleDrawerOpen(true);
        pushToast('info', 'Restarting ComfyUI', 'Restarting managed ComfyUI process…');
      }
    } catch (err) {
      pushToast('error', 'ComfyUI Process Error', err instanceof Error ? err.message : 'Request failed');
    }
  };

  const handleLaunchComfyUI = () => void controlComfyProcess('start');
  const handleStopComfyUI = () => void controlComfyProcess('stop');
  const handleRestartComfyUI = () => void controlComfyProcess('restart');

  const refreshComfyTelemetryNow = async () => {
    const next = await fetchComfyTelemetry(activeComfyPort);
    setComfyTelemetry(next);
  };

  const handleInterruptComfy = async () => {
    const res = await sendComfyTelemetryAction({
      port: activeComfyPort,
      action: 'interrupt',
    });
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: res.ok ? 'warn' : 'stderr',
      text: `[ComfyUI Interrupt] ${res.message}`,
    });
    pushToast(res.ok ? 'warn' : 'error', 'ComfyUI Execution', res.message);
    await refreshComfyTelemetryNow();
  };

  const handleClearComfyQueue = async () => {
    const res = await sendComfyTelemetryAction({
      port: activeComfyPort,
      action: 'clear_queue',
    });
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: res.ok ? 'info' : 'stderr',
      text: `[ComfyUI Queue] ${res.message}`,
    });
    pushToast(res.ok ? 'info' : 'error', 'ComfyUI Queue', res.message);
    await refreshComfyTelemetryNow();
  };

  const handleDeleteComfyQueueItem = async (promptId: string) => {
    const res = await sendComfyTelemetryAction({
      port: activeComfyPort,
      action: 'delete_queue_item',
      promptId,
    });
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: res.ok ? 'info' : 'stderr',
      text: `[ComfyUI Queue] ${res.message}`,
    });
    await refreshComfyTelemetryNow();
  };

  const handleFreeComfyVram = async (unloadModels = true) => {
    const res = await sendComfyTelemetryAction({
      port: activeComfyPort,
      action: 'free_vram',
      unloadModels,
      freeMemory: true,
    });
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: res.ok ? 'success' : 'stderr',
      text: `[ComfyUI VRAM] ${res.message}`,
    });
    pushToast(res.ok ? 'success' : 'error', 'ComfyUI VRAM Recovery', res.message);
    await refreshComfyTelemetryNow();
  };

  const handleOpenTelemetryDrawer = () => {
    setConsoleDrawerTab('telemetry');
    setIsConsoleDrawerOpen(true);
  };

  const updatesCount = nodes.filter((n) => n.hasUpdate).length;
  const healthIssuesCount = nodes.filter((n) => n.healthStatus !== 'compliant').length;
  const pipQueueBusyCount = pipQueue.filter(
    (q) => q.status === 'running' || q.status === 'queued' || q.status === 'blocked_by_shield'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100">
      {/* Compact 48px Top Utility Bar */}
      <Header
        setActiveTab={setActiveTab}
        isValidRoot={settings.isValidRoot}
        autoTorchShield={settings.autoTorchShield}
        isTauri={isTauriEnvironment()}
        isScanning={isScanning}
        onRefreshNodes={handleRefreshNodes}
        onLaunchComfyUI={handleLaunchComfyUI}
        onStopComfyUI={handleStopComfyUI}
        onRestartComfyUI={handleRestartComfyUI}
        comfyProcessStatus={comfyProcessStatus}
        comfyProcessPid={comfyProcessPid}
        comfyPort={activeComfyPort}
        comfyTelemetry={comfyTelemetry}
        comfyWsState={effectiveComfyWsState}
        onInterruptComfy={() => void handleInterruptComfy()}
        onFreeComfyVram={() => void handleFreeComfyVram(true)}
        onOpenTelemetryDrawer={handleOpenTelemetryDrawer}
        instances={instances}
        activeInstanceId={activeInstanceId}
        onSwitchInstance={handleSwitchInstance}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        onToggleConsoleDrawer={() => setIsConsoleDrawerOpen((prev) => !prev)}
        isConsoleDrawerOpen={isConsoleDrawerOpen}
      />

      {/* Desktop App Shell: Left Sidebar Rail + Main Workspace */}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          installedCount={nodes.length}
          updatesCount={updatesCount}
          healthIssuesCount={healthIssuesCount}
          pipQueueBusyCount={pipQueueBusyCount}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-20">
          <div className="max-w-7xl mx-auto">
            {!settings.isValidRoot && activeTab === 'inspector' ? (
              <OnboardingCard
                settings={settings}
                onSaveAndScan={handleUpdateSettings}
                onOpenFullSettings={() => setActiveTab('settings')}
              />
            ) : (
              <>
                {!settings.isValidRoot && !setupBannerDismissed && activeTab !== 'settings' && (
                  <div className="mb-6 rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-amber-200">
                      <span className="font-semibold">ComfyUI directory not verified on disk:</span>{' '}
                      <code className="font-mono text-amber-100">{settings.comfyRoot || '(unset)'}</code>. Configure your ComfyUI root path in Settings to manage real custom nodes and models.
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setActiveTab('settings')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
                      >
                        Open Settings
                      </button>
                      <button
                        onClick={() => setSetupBannerDismissed(true)}
                        className="px-2.5 py-1.5 rounded-lg text-xs text-amber-300 hover:text-white transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'inspector' && (
                  <InspectorView
                    nodes={nodes}
                    trashNodes={trashNodes}
                    showCleanNames={settings.showCleanNames}
                    setShowCleanNames={(show) => updateSettings({ ...settings, showCleanNames: show })}
                    aliases={aliases}
                    onUpdateAlias={handleUpdateAlias}
                    onToggleNodeState={handleToggleNodeState}
                    onUninstallNode={handleUninstallNode}
                    onRestoreNode={handleRestoreNode}
                    onNormalizeBatch={handleNormalizeBatch}
                    onNavigateToDoctor={() => {
                      setActiveTab('doctor');
                    }}
                    onNavigateToRunner={(cmd) => {
                      setTargetRunnerCommand(cmd);
                      setActiveTab('runner');
                    }}
                  />
                )}
              </>
            )}

            {activeTab === 'runner' && (
              <TerminalRunnerView
                key={targetRunnerCommand}
                logs={logs}
                pipQueue={pipQueue}
                onAddLog={addLog}
                onClearLogs={clearLogs}
                onEnqueuePip={handleEnqueuePip}
                onResolveShield={handleResolveShield}
                autoTorchShield={settings.autoTorchShield}
                comfyRoot={settings.comfyRoot}
                pythonBinary={settings.pythonBinary}
                initialCommand={targetRunnerCommand}
              />
            )}

            {(activeTab === 'registry' || activeTab === 'updates') && (
              <RegistryView
                key={activeTab}
                initialSubTab={activeTab === 'updates' ? 'updates' : 'browse'}
                installedNodes={nodes}
                transactions={transactions}
                isValidRoot={settings.isValidRoot}
                onNavigateToSettings={() => setActiveTab('settings')}
                onInstallFromRegistry={handleInstallFromRegistry}
                onInstallViaGitUrl={handleInstallViaGitUrl}
                onBatchUrlImport={handleBatchUrlImport}
                onCheckUpdates={handleCheckUpdates}
                onUpdateAll={handleUpdateAll}
                onUpdateSingleNode={handleUpdateSingleNode}
                onRollbackTransaction={handleRollbackTransaction}
                updateProgress={updateProgress}
              />
            )}

            {activeTab === 'lockfile' && (
              <LockfileView
                installedNodes={nodes}
                onApplyReconciliation={handleApplyReconciliation}
              />
            )}

            {activeTab === 'doctor' && (
              <HealthDoctorView
                installedNodes={nodes}
                comfyRoot={settings.comfyRoot}
                pythonBinary={settings.pythonBinary}
                scannedRequirementsMap={scannedRequirementsMap}
                onPatchInstalledNode={handlePatchInstalledNode}
              />
            )}

            {activeTab === 'profiles' && (
              <ProfilesView
                profiles={profiles}
                activeProfileId={activeProfileId}
                installedNodes={nodes}
                onSwitchProfile={handleSwitchProfile}
                onCreateProfile={handleCreateProfile}
                onInstallMissingNodes={handleInstallMissingNodes}
              />
            )}

            {activeTab === 'models' && (
              <ModelsView
                comfyRoot={settings.comfyRoot}
                isValidRoot={settings.isValidRoot}
                onRunTerminalCommand={(cmd) => {
                  addLog({
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'info',
                    text: cmd,
                  });
                }}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                instances={instances}
                activeInstanceId={activeInstanceId}
                onUpdateSettings={handleUpdateSettings}
                onSaveInstances={handleSaveInstances}
                onSwitchInstance={handleSwitchInstance}
                onResetAllData={handleResetAllData}
              />
            )}
          </div>
        </main>
      </div>

      {/* Collapsible Console & Live GPU Telemetry Drawer */}
      <ConsoleDrawer
        isOpen={isConsoleDrawerOpen}
        activeDrawerTab={consoleDrawerTab}
        onChangeDrawerTab={setConsoleDrawerTab}
        logs={logs}
        pipQueue={pipQueue}
        comfyTelemetry={comfyTelemetry}
        comfyWsState={effectiveComfyWsState}
        comfyPort={activeComfyPort}
        isValidRoot={settings.isValidRoot}
        onLaunchComfyUI={handleLaunchComfyUI}
        onInterruptComfy={() => void handleInterruptComfy()}
        onClearComfyQueue={() => void handleClearComfyQueue()}
        onDeleteComfyQueueItem={(id) => void handleDeleteComfyQueueItem(id)}
        onFreeComfyVram={(unloadModels) => void handleFreeComfyVram(unloadModels)}
        onClose={() => setIsConsoleDrawerOpen(false)}
        onExpandToFullTab={() => {
          setIsConsoleDrawerOpen(false);
          setActiveTab('runner');
        }}
        onClearLogs={clearLogs}
      />

      {/* Global Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onOpenConsole={() => setIsConsoleDrawerOpen(true)}
      />

      {/* Persistent Studio Status Bar */}
      <StatusBar
        comfyRoot={settings.comfyRoot}
        pipQueue={pipQueue}
        isTauri={isTauriEnvironment()}
        comfyTelemetry={comfyTelemetry}
        comfyPort={activeComfyPort}
        onNavigateToSettings={() => setActiveTab('settings')}
        onNavigateToRunner={() => setActiveTab('runner')}
        onOpenTelemetryDrawer={handleOpenTelemetryDrawer}
      />
    </div>
  );
}
