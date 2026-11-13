export type PhaseId = 
  | 'phase-0' 
  | 'phase-1' 
  | 'phase-2' 
  | 'phase-3' 
  | 'phase-4' 
  | 'phase-5' 
  | 'phase-6' 
  | 'phase-7';

export interface RoadmapTask {
  id: string;
  phaseId: PhaseId;
  phaseTitle: string;
  title: string;
  description: string;
  completed: boolean;
  category: 'core' | 'rust' | 'frontend' | 'security' | 'sync' | 'packaging';
  technicalDetails?: string;
  githubLabels: string[];
  linearPriority: 'Urgent' | 'High' | 'Medium' | 'Low';
}

export type HealthStatus = 'compliant' | 'fragile' | 'os_locked';

export interface HealthIssue {
  id: string;
  rule: 'hardcoded_import' | 'windows_path' | 'absolute_path';
  title: string;
  description: string;
  file: string;
  line: number;
  snippet: string;
  patchable: boolean;
  suggestedPatch?: string;
}

export interface InstalledNode {
  id: string;
  folderName: string;
  cleanDisplayName: string;
  enabled: boolean;
  gitUrl: string;
  currentCommit: string;
  branch: string;
  latestCommit?: string;
  hasUpdate: boolean;
  filesCount: number;
  sizeMb: number;
  healthStatus: HealthStatus;
  healthIssues: HealthIssue[];
  installedAt: string;
  category: string;
  author: string;
  description: string;
  providesNodes: string[];
  normalizedProposedName?: string;
}

export interface RegistryNode {
  id: string;
  name: string;
  author: string;
  description: string;
  gitUrl: string;
  stars: number;
  category: string;
  nodeClasses: string[];
  requirements: string[];
  hasTorchRisk: boolean;
  recommended: boolean;
}

export interface LockfileNodeEntry {
  name: string;
  url: string;
  commit_hash: string;
  branch: string;
  enabled_state: boolean;
}

export interface ComfyLockfile {
  version: string;
  generated_at: string;
  comfyui_version: string;
  nodes: LockfileNodeEntry[];
}

export interface ReconciliationItem {
  name: string;
  action: 'clone' | 'checkout' | 'keep_or_disable' | 'toggle_state' | 'in_sync';
  reason: string;
  currentCommit?: string;
  targetCommit?: string;
  currentEnabled?: boolean;
  targetEnabled?: boolean;
  gitUrl: string;
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  targetNodeFolders: string[];
  updatedAt: string;
}

export interface WorkflowInspectionResult {
  fileName: string;
  fileType: 'png' | 'json';
  extractedClasses: string[];
  matchedNodes: {
    className: string;
    nodeFolderName: string;
    nodeDisplayName: string;
    installed: boolean;
    enabled: boolean;
  }[];
  missingNodes: {
    className: string;
    suggestedRegistryNode?: RegistryNode;
  }[];
  totalNodesCount: number;
}

export interface TerminalLogEntry {
  id: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'info' | 'shield' | 'success' | 'warn';
  text: string;
}

export interface PipQueueItem {
  id: string;
  nodeName: string;
  requirements: string[];
  status: 'queued' | 'running' | 'completed' | 'blocked_by_shield' | 'failed';
  hasTorchShieldTriggered: boolean;
  strippedTorchPackages: string[];
  startedAt?: string;
  finishedAt?: string;
}

export interface EnvironmentSettings {
  comfyRoot: string;
  pythonBinary: string;
  pythonType: 'windows_portable' | 'virtualenv' | 'system' | 'custom';
  isValidRoot: boolean;
  hasMainPy: boolean;
  hasCustomNodes: boolean;
  showCleanNames: boolean;
  autoTorchShield: boolean;
  comfyPort?: number;
  minimizeToTray?: boolean;
}

export interface ComfyInstance {
  id: string;
  name: string;
  comfyRoot: string;
  pythonBinary: string;
  pythonType: EnvironmentSettings['pythonType'];
  port: number;
}

export interface DependencyRequirement {
  nodeFolderName: string;
  rawRequirement: string;
  packageName: string;
  comparator?: string;
  version?: string;
}

export interface DependencyConflict {
  id: string;
  packageName: string;
  severity: 'critical' | 'warning';
  nodesInvolved: {
    folderName: string;
    requirement: string;
  }[];
  description: string;
  recommendedResolution: string;
}

export type ModelCategory = 'checkpoints' | 'loras' | 'controlnet' | 'vae' | 'upscale_models';
export type BaseModelFamily = 'Flux.1' | 'SDXL' | 'SD1.5' | 'SD3' | 'HunyuanVideo' | 'Unknown';

export interface ModelAsset {
  id: string;
  fileName: string;
  category: ModelCategory;
  relativePath: string;
  sizeBytes: number;
  sizeGb: number;
  hash: string;
  baseModel: BaseModelFamily;
  isDuplicate: boolean;
  duplicateGroupId?: string;
  isSymlink: boolean;
  symlinkTarget?: string;
}

export interface ModelDeduplicationResult {
  totalModelsCount: number;
  totalStorageGb: number;
  duplicateGroups: {
    hash: string;
    fileName: string;
    sizeGb: number;
    assets: ModelAsset[];
  }[];
  potentialSavingsGb: number;
}

export interface VramEstimationParams {
  baseModel: BaseModelFamily;
  quantization: 'fp16' | 'bf16' | 'fp8' | 'q4';
  resolution: '512x512' | '768x768' | '1024x1024' | '1920x1080';
  batchSize: number;
  loraCount: number;
  controlNetCount: number;
}

export interface VramEstimateResult {
  baseWeightsVramGb: number;
  activationsVramGb: number;
  loraVramGb: number;
  controlNetVramGb: number;
  totalPeakVramGb: number;
  tierRecommendation: string;
  fitsIn8Gb: boolean;
  fitsIn12Gb: boolean;
  fitsIn16Gb: boolean;
  fitsIn24Gb: boolean;
  warnings: string[];
}

export interface UpdateTransaction {
  id: string;
  nodeFolderName: string;
  nodeDisplayName: string;
  previousCommit: string;
  targetCommit: string;
  timestamp: string;
  status: 'applied' | 'rolled_back';
  rollbackCommand: string;
}
