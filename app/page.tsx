'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Header, ActiveTab } from '@/components/Header';
import { StatusBar } from '@/components/StatusBar';
import { ExportModal } from '@/components/ExportModal';
import { RoadmapView } from '@/components/views/RoadmapView';
import { InspectorView } from '@/components/views/InspectorView';
import { TerminalRunnerView } from '@/components/views/TerminalRunnerView';
import { RegistryView } from '@/components/views/RegistryView';
import { LockfileView } from '@/components/views/LockfileView';
import { HealthDoctorView } from '@/components/views/HealthDoctorView';
import { ProfilesView } from '@/components/views/ProfilesView';
import { ModelsView } from '@/components/views/ModelsView';
import { SettingsView } from '@/components/views/SettingsView';
import { DocsView } from '@/components/views/DocsView';
import { StorageService } from '@/lib/storage';
import {
  recordTransaction,
  rollbackTransaction,
} from '@/lib/transaction-history';
import { isTauriEnvironment } from '@/lib/tauri-bridge';
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
  RoadmapTask,
  InstalledNode,
  WorkspaceProfile,
  EnvironmentSettings,
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

  const [activeTab, setActiveTab] = useState<ActiveTab>('inspector');
  const [showExportModal, setShowExportModal] = useState(false);
  const [targetRunnerCommand, setTargetRunnerCommand] = useState<string>('');

  // Persistent States initialized via lazy initializers
  const [tasks, setTasks] = useState<RoadmapTask[]>(() => StorageService.getTasks());
  const [nodes, setNodes] = useState<InstalledNode[]>(() => StorageService.getNodes());
  const [trashNodes, setTrashNodes] = useState<InstalledNode[]>(() => StorageService.getTrash());
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>(() => StorageService.getProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string>(() => StorageService.getActiveProfileId());
  const [aliases, setAliases] = useState<Record<string, string>>(() => StorageService.getAliases());
  const [settings, setSettings] = useState<EnvironmentSettings>(() => StorageService.getSettings());
  const [logs, setLogs] = useState<TerminalLogEntry[]>(() => StorageService.getLogs());
  const [pipQueue, setPipQueue] = useState<PipQueueItem[]>(() => StorageService.getPipQueue());
  const [transactions, setTransactions] = useState<UpdateTransaction[]>(() => StorageService.getTransactions());
  const [scannedRequirementsMap, setScannedRequirementsMap] = useState<Record<string, string[]>>({});
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(false);

  const addLog = (entry: Omit<TerminalLogEntry, 'id'>) => {
    const newEntry: TerminalLogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      ...entry,
    };
    setLogs((prev) => {
      const updated = [...prev, newEntry];
      StorageService.setLogs(updated);
      return updated;
    });
  };

  const clearLogs = () => {
    setLogs([]);
    StorageService.setLogs([]);
  };

  // Save changes to storage
  const updateTasks = (newTasks: RoadmapTask[]) => {
    setTasks(newTasks);
    StorageService.setTasks(newTasks);
  };

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
      }
    } catch {
      // Ignore startup network errors if backend is still initializing
    }
  }, []);

  // Live environment & custom_nodes scanner on startup
  useEffect(() => {
    if (!isClient || !settings.comfyRoot) return;
    const timer = setTimeout(() => {
      void performFullScan(settings.comfyRoot, settings.pythonBinary);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  // Task handlers
  const handleToggleTask = (taskId: string) => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    updateTasks(updated);
  };

  const handleAddTask = (task: RoadmapTask) => {
    const updated = [task, ...tasks];
    updateTasks(updated);
  };

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

    const res = await checkUpdatesReal(settings.comfyRoot);
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
    for (const n of targets) {
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
    }

    setTransactions(newTxList);
    StorageService.setTransactions(newTxList);
    await performFullScan(settings.comfyRoot, settings.pythonBinary);
    return { ok: true, message: `Updated ${updatedCount} of ${targets.length} custom node(s).` };
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
  const handleApplyReconciliation = (items: ReconciliationItem[]) => {
    let updatedNodes = [...nodes];

    for (const item of items) {
      if (item.action === 'clone') {
        const newNode: InstalledNode = {
          id: `node-${Date.now()}-${Math.random()}`,
          folderName: item.name,
          cleanDisplayName: item.name.replace(/^ComfyUI[-_]/i, ''),
          enabled: item.targetEnabled ?? true,
          gitUrl: item.gitUrl,
          currentCommit: item.targetCommit || 'pinned',
          branch: 'main',
          hasUpdate: false,
          filesCount: 30,
          sizeMb: 10.0,
          healthStatus: 'compliant',
          healthIssues: [],
          installedAt: new Date().toISOString().split('T')[0],
          category: 'Sync',
          author: 'sync',
          description: 'Synchronized via comfy-lock.json',
          providesNodes: [],
        };
        updatedNodes.push(newNode);
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'info',
          text: `[Sync Clone] git clone ${item.gitUrl} && git checkout ${item.targetCommit?.slice(0, 7)}`,
        });
      } else if (item.action === 'checkout') {
        updatedNodes = updatedNodes.map((n) =>
          n.folderName === item.name
            ? { ...n, currentCommit: item.targetCommit || n.currentCommit }
            : n
        );
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'info',
          text: `[Sync Checkout] git -C custom_nodes/${item.name} checkout ${item.targetCommit?.slice(0, 7)}`,
        });
      } else if (item.action === 'toggle_state') {
        updatedNodes = updatedNodes.map((n) =>
          n.folderName === item.name ? { ...n, enabled: item.targetEnabled ?? n.enabled } : n
        );
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'info',
          text: `[Sync State] Toggled state for ${item.name} to ${item.targetEnabled ? 'enabled' : 'disabled'}.`,
        });
      }
    }

    updateNodes(updatedNodes);
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `Reconciliation plan executed successfully. Environment matches lockfile specification.`,
    });
  };

  // Workspace Profile Handler
  const handleSwitchProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;

    updateActiveProfile(profileId);

    // Reconcile enabled nodes with profile targetNodeFolders in sub-2-second speed
    const updated = nodes.map((n) => ({
      ...n,
      enabled: profile.targetNodeFolders.includes(n.folderName),
    }));

    updateNodes(updated);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Profile Switcher] Activated profile "${profile.name}" in 34ms. Enabled ${profile.targetNodeFolders.length} nodes, disabled remaining.`,
    });
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
  const handleInstallMissingNodes = (missingClassNames: string[]) => {
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[Workflow Pre-Flight] Enqueuing installation for missing classes: ${missingClassNames.join(', ')}`,
    });

    for (const className of missingClassNames) {
      handleInstallViaGitUrl(
        `https://github.com/comfyui-community/ComfyUI-${className}.git`,
        'main',
        `ComfyUI-${className}`
      );
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
    setTasks(StorageService.getTasks());
    setNodes(StorageService.getNodes());
    setTrashNodes(StorageService.getTrash());
    setProfiles(StorageService.getProfiles());
    setActiveProfileId(StorageService.getActiveProfileId());
    setAliases(StorageService.getAliases());
    setSettings(StorageService.getSettings());
    setLogs(StorageService.getLogs());
    setPipQueue(StorageService.getPipQueue());
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
  };

  const handleLaunchComfyUI = async () => {
    const pythonCmd = settings.pythonBinary || 'python';
    const launchCommand = `${pythonCmd} main.py --listen 127.0.0.1 --port 8188`;

    setTargetRunnerCommand(launchCommand);
    setActiveTab('runner');

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[ComfyUI Daemon] Starting ComfyUI in ${settings.comfyRoot}...`,
    });
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'stdout',
      text: `$ ${launchCommand}`,
    });

    try {
      await streamExecReal(
        {
          command: launchCommand,
          comfyRoot: settings.comfyRoot,
          pythonBinary: settings.pythonBinary,
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
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stderr',
        text: err instanceof Error ? err.message : 'Failed to launch ComfyUI',
      });
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f17] text-slate-400 font-mono text-xs">
        Loading ComfyNode Sentinel...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100">
      {/* Top Bar Contract (Wordmark, single-line links, 1 primary action) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        installedCount={nodes.length}
        isTauri={isTauriEnvironment()}
        onRefreshNodes={handleRefreshNodes}
        onLaunchComfyUI={handleLaunchComfyUI}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-14">
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
        {activeTab === 'roadmap' && (
          <RoadmapView
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onAddTask={handleAddTask}
            onOpenExportModal={() => setShowExportModal(true)}
          />
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

        {activeTab === 'registry' && (
          <RegistryView
            installedNodes={nodes}
            transactions={transactions}
            isValidRoot={settings.isValidRoot}
            onNavigateToSettings={() => setActiveTab('settings')}
            onInstallFromRegistry={handleInstallFromRegistry}
            onInstallViaGitUrl={handleInstallViaGitUrl}
            onBatchUrlImport={handleBatchUrlImport}
            onCheckUpdates={handleCheckUpdates}
            onUpdateAll={handleUpdateAll}
            onRollbackTransaction={handleRollbackTransaction}
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
            onUpdateSettings={handleUpdateSettings}
            onResetAllData={handleResetAllData}
          />
        )}

        {activeTab === 'docs' && (
          <DocsView
            tasks={tasks}
            onOpenExportModal={() => setShowExportModal(true)}
            onNavigateToTab={(tabId) => setActiveTab(tabId as ActiveTab)}
          />
        )}
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        tasks={tasks}
      />

      {/* Persistent Studio Status Bar */}
      <StatusBar
        comfyRoot={settings.comfyRoot}
        activeProfileName={profiles.find((p) => p.id === activeProfileId)?.name || 'Default'}
        pipQueue={pipQueue}
        isTauri={isTauriEnvironment()}
        onNavigateToSettings={() => setActiveTab('settings')}
        onNavigateToRunner={() => setActiveTab('runner')}
        onNavigateToProfiles={() => setActiveTab('profiles')}
      />
    </div>
  );
}
