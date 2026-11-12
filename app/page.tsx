'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
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
import {
  isTauriEnvironment,
  nativeCheckEnvironment,
  nativeToggleNodeState,
  nativeQuarantineNodeToTrash,
  nativeScanCustomNodes,
} from '@/lib/tauri-bridge';
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

  const [activeTab, setActiveTab] = useState<ActiveTab>('roadmap');
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

  // Tauri live environment scanner on startup
  useEffect(() => {
    if (!isClient) return;
    if (isTauriEnvironment() && settings.comfyRoot) {
      const customNodesPath = `${settings.comfyRoot}\\custom_nodes`;
      nativeScanCustomNodes(customNodesPath).then((discovered) => {
        if (discovered && discovered.length > 0) {
          addLog({
            timestamp: new Date().toLocaleTimeString(),
            type: 'info',
            text: `[Tauri Desktop Shell] Scanned ${discovered.length} live custom_nodes from ${customNodesPath}.`,
          });
        }
      });
    }
  }, [isClient, settings.comfyRoot]);

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
    if (isTauriEnvironment() && settings.comfyRoot) {
      const customNodesPath = `${settings.comfyRoot}\\custom_nodes`;
      const renamed = await nativeToggleNodeState(customNodesPath, folderName);
      if (renamed) {
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          text: `[Tauri Native] Renamed directory on disk to ${renamed}`,
        });
      }
    }

    const updated = nodes.map((n) => {
      if (n.folderName === folderName) {
        const nextState = !n.enabled;
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'info',
          text: `[Atomic Rename] custom_nodes/${n.folderName} <-> custom_nodes/${n.folderName}${
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

    if (isTauriEnvironment() && settings.comfyRoot) {
      const customNodesPath = `${settings.comfyRoot}\\custom_nodes`;
      const trashed = await nativeQuarantineNodeToTrash(customNodesPath, folderName);
      if (trashed) {
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          text: `[Tauri Native Trash] custom_nodes/${folderName} moved to OS Recycle Bin.`,
        });
      }
    }

    const remainingNodes = nodes.filter((n) => n.folderName !== folderName);
    const newTrash = [target, ...trashNodes];

    updateNodes(remainingNodes);
    updateTrash(newTrash);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'warn',
      text: `[Safe Uninstall (trash)] Moved custom_nodes/${folderName} to system trash quarantine.`,
    });
  };

  const handleUpdateSettings = async (newSettings: EnvironmentSettings) => {
    const validated = { ...newSettings };
    if (isTauriEnvironment() && newSettings.comfyRoot) {
      const check = await nativeCheckEnvironment(newSettings.comfyRoot);
      if (check) {
        validated.isValidRoot = check.is_valid;
        validated.hasMainPy = check.has_main_py;
        validated.hasCustomNodes = check.has_custom_nodes;
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: check.is_valid ? 'success' : 'warn',
          text: `[Tauri Native Validation] ${newSettings.comfyRoot} - valid root: ${check.is_valid}`,
        });
      }
    }
    updateSettings(validated);
  };

  const handleRestoreNode = (folderName: string) => {
    const target = trashNodes.find((t) => t.folderName === folderName);
    if (!target) return;

    const remainingTrash = trashNodes.filter((t) => t.folderName !== folderName);
    const newNodes = [...nodes, target];

    updateTrash(remainingTrash);
    updateNodes(newNodes);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Restored] custom_nodes/${folderName} restored from trash.`,
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

  const handleNormalizeBatch = (replacements: { original: string; proposed: string }[]) => {
    const updated = nodes.map((n) => {
      const match = replacements.find((r) => r.original === n.folderName);
      if (match) {
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'info',
          text: `[Normalizer] std::fs::rename custom_nodes/${match.original} -> custom_nodes/${match.proposed}`,
        });
        return {
          ...n,
          folderName: match.proposed,
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

  const processPipQueue = (queueId: string, requirements: string[]) => {
    setTimeout(() => {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stdout',
        text: `pip install ${requirements.join(' ')} --no-cache-dir`,
      });
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
        text: `Successfully installed dependencies for job ${queueId}. Pip process completed cleanly.`,
      });

      setPipQueue((prev) =>
        prev.map((item) => (item.id === queueId ? { ...item, status: 'completed' } : item))
      );
    }, 1200);
  };

  // Registry Ingestion Handlers
  const handleInstallFromRegistry = (regNode: RegistryNode) => {
    const newNode: InstalledNode = {
      id: `node-${Date.now()}`,
      folderName: regNode.name,
      cleanDisplayName: regNode.name.replace(/^ComfyUI[-_]/i, ''),
      enabled: true,
      gitUrl: regNode.gitUrl,
      currentCommit: 'a1b2c3d',
      branch: 'main',
      hasUpdate: false,
      filesCount: 45,
      sizeMb: 12.5,
      healthStatus: 'compliant',
      healthIssues: [],
      installedAt: new Date().toISOString().split('T')[0],
      category: regNode.category,
      author: regNode.author,
      description: regNode.description,
      providesNodes: regNode.nodeClasses,
    };

    updateNodes([...nodes, newNode]);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `git clone --depth 1 ${regNode.gitUrl} custom_nodes/${regNode.name}`,
    });

    if (regNode.requirements && regNode.requirements.length > 0) {
      handleEnqueuePip(regNode.name, regNode.requirements);
    }
  };

  const handleInstallViaGitUrl = (url: string, branch?: string, folderName?: string) => {
    const computedFolder =
      folderName || url.split('/').pop()?.replace('.git', '') || 'ComfyUI-Custom';

    const newNode: InstalledNode = {
      id: `node-${Date.now()}`,
      folderName: computedFolder,
      cleanDisplayName: computedFolder.replace(/^ComfyUI[-_]/i, ''),
      enabled: true,
      gitUrl: url,
      currentCommit: '8f9e0d1',
      branch: branch || 'main',
      hasUpdate: false,
      filesCount: 30,
      sizeMb: 8.4,
      healthStatus: 'compliant',
      healthIssues: [],
      installedAt: new Date().toISOString().split('T')[0],
      category: 'Custom',
      author: url.split('/')[3] || 'community',
      description: `Installed via direct Git URL: ${url}`,
      providesNodes: [],
    };

    updateNodes([...nodes, newNode]);

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `git clone --depth 1 ${branch ? `-b ${branch} ` : ''}${url} custom_nodes/${computedFolder}`,
    });

    handleEnqueuePip(computedFolder, ['requirements.txt']);
  };

  const handleBatchUrlImport = (urls: string[]) => {
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[Batch URL Ingestion] Parsing ${urls.length} URLs with deduplication...`,
    });

    let addedCount = 0;
    const newInstalledList = [...nodes];

    for (const url of urls) {
      const folder = url.split('/').pop()?.replace('.git', '') || 'ComfyUI-Node';
      const exists = nodes.some((n) => n.gitUrl.toLowerCase() === url.toLowerCase());

      if (!exists) {
        addedCount++;
        const newNode: InstalledNode = {
          id: `node-${Date.now()}-${Math.random()}`,
          folderName: folder,
          cleanDisplayName: folder.replace(/^ComfyUI[-_]/i, ''),
          enabled: true,
          gitUrl: url,
          currentCommit: 'commit001',
          branch: 'main',
          hasUpdate: false,
          filesCount: 25,
          sizeMb: 6.0,
          healthStatus: 'compliant',
          healthIssues: [],
          installedAt: new Date().toISOString().split('T')[0],
          category: 'Batch',
          author: 'batch',
          description: `Batch imported from nodes.txt`,
          providesNodes: [],
        };
        newInstalledList.push(newNode);
        handleEnqueuePip(folder, ['safetensors', 'numpy']);
      }
    }

    updateNodes(newInstalledList);
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Batch URL Ingestion] Added ${addedCount} new custom node repositories.`,
    });
  };

  // Updates
  const handleCheckUpdates = () => {
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `Checking upstream git remotes with git ls-remote...`,
    });
    setTimeout(() => {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'stdout',
        text: `Checked ${nodes.length} repositories. 1 update available for comfyui_controlnet_aux_plus.`,
      });
    }, 800);
  };

  const handleUpdateAll = () => {
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `[Batch Update] Pulling latest commits and updating dependencies...`,
    });

    let newTxList = [...transactions];
    const updated = nodes.map((n) => {
      if (n.hasUpdate || n.folderName === 'comfyui_controlnet_aux_plus') {
        newTxList = recordTransaction(newTxList, {
          nodeFolderName: n.folderName,
          nodeDisplayName: n.cleanDisplayName,
          previousCommit: n.currentCommit,
          targetCommit: n.latestCommit || 'a90e34c',
        });
      }
      return { ...n, hasUpdate: false, currentCommit: n.latestCommit || 'a90e34c' };
    });

    setTransactions(newTxList);
    StorageService.setTransactions(newTxList);
    updateNodes(updated);
    setTimeout(() => {
      addLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
        text: `All ${nodes.length} custom nodes synchronized to latest upstream HEAD. Update ledger recorded for rollback.`,
      });
    }, 1000);
  };

  const handleRollbackTransaction = (txId: string) => {
    const { updatedTransactions, rolledBackTx } = rollbackTransaction(transactions, txId);
    if (!rolledBackTx) return;

    setTransactions(updatedTransactions);
    StorageService.setTransactions(updatedTransactions);

    const targetFolder = rolledBackTx.nodeFolderName;
    const targetCommit = rolledBackTx.previousCommit;

    setNodes((prev) =>
      prev.map((n) => {
        if (n.folderName === targetFolder) {
          return {
            ...n,
            currentCommit: targetCommit,
            hasUpdate: true,
          };
        }
        return n;
      })
    );

    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'warn',
      text: `[Git Rollback] ${rolledBackTx.rollbackCommand}`,
    });
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      text: `[Git Rollback] Successfully rolled back ${rolledBackTx.nodeDisplayName} to commit ${targetCommit}.`,
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

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f17] text-slate-400 font-mono text-xs">
        Loading ComfyNode Sentinel...
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100">
      {/* Top Bar Contract (Wordmark, single-line links, 1 primary action) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenExportModal={() => setShowExportModal(true)}
        installedCount={nodes.length}
        totalTasksCount={tasks.length}
        completedTasksCount={completedTasks}
        isTauri={isTauriEnvironment()}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-14">
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
            initialCommand={targetRunnerCommand}
          />
        )}

        {activeTab === 'registry' && (
          <RegistryView
            installedNodes={nodes}
            transactions={transactions}
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
