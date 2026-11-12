'use client';

import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Zap,
  Film,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  Download,
  Plus,
  ArrowRight,
} from 'lucide-react';
import {
  WorkspaceProfile,
  InstalledNode,
  WorkflowInspectionResult,
} from '@/types';
import { extractWorkflowFromBuffer } from '@/lib/png-metadata';
import { COMMUNITY_REGISTRY } from '@/lib/default-data';

interface ProfilesViewProps {
  profiles: WorkspaceProfile[];
  activeProfileId: string;
  installedNodes: InstalledNode[];
  onSwitchProfile: (profileId: string) => void;
  onCreateProfile: (name: string, description: string) => void;
  onInstallMissingNodes: (missingClassNames: string[]) => void;
}

export function ProfilesView({
  profiles,
  activeProfileId,
  installedNodes,
  onSwitchProfile,
  onCreateProfile,
  onInstallMissingNodes,
}: ProfilesViewProps) {
  const [activeTab, setActiveTab] = useState<'profiles' | 'preflight'>('preflight');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');

  // Workflow drop / inspect state
  const [isDragging, setIsDragging] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<WorkflowInspectionResult | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getProfileIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap':
        return Zap;
      case 'Film':
        return Film;
      case 'UserCheck':
        return UserCheck;
      default:
        return Sparkles;
    }
  };

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    try {
      if (file.type.startsWith('image/') || file.name.endsWith('.png')) {
        const url = URL.createObjectURL(file);
        setPreviewImageUrl(url);
      } else {
        setPreviewImageUrl(null);
      }
      const extracted = await extractWorkflowFromBuffer(file);
      analyzeWorkflowClasses(file.name, file.name.endsWith('.png') ? 'png' : 'json', extracted.nodeTypes);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error parsing workflow file.');
      setInspectionResult(null);
      setPreviewImageUrl(null);
    }
  };

  const analyzeWorkflowClasses = (fileName: string, fileType: 'png' | 'json', classNames: string[]) => {
    const matchedNodes: WorkflowInspectionResult['matchedNodes'] = [];
    const missingNodes: WorkflowInspectionResult['missingNodes'] = [];

    // Built-in ComfyUI standard nodes
    const builtInNodes = new Set([
      'KSampler',
      'CheckpointLoaderSimple',
      'CLIPTextEncode',
      'VAEDecode',
      'VAEEncode',
      'EmptyLatentImage',
      'SaveImage',
      'PreviewImage',
      'LoadImage',
      'CLIPSetLastLayer',
      'ConditioningCombine',
      'ConditioningAverage',
      'SetLatentNoiseMask',
    ]);

    for (const className of classNames) {
      // Find if an installed node provides this class
      const installedMatch = installedNodes.find(
        (n) => n.providesNodes && n.providesNodes.includes(className)
      );

      if (installedMatch) {
        matchedNodes.push({
          className,
          nodeFolderName: installedMatch.folderName,
          nodeDisplayName: installedMatch.cleanDisplayName,
          installed: true,
          enabled: installedMatch.enabled,
        });
      } else if (builtInNodes.has(className)) {
        matchedNodes.push({
          className,
          nodeFolderName: 'ComfyUI Core (Built-in)',
          nodeDisplayName: 'ComfyUI Core Engine',
          installed: true,
          enabled: true,
        });
      } else {
        // Try to find community registry node that provides it
        const regMatch = COMMUNITY_REGISTRY.find(
          (r) => r.nodeClasses && r.nodeClasses.includes(className)
        );
        missingNodes.push({
          className,
          suggestedRegistryNode: regMatch,
        });
      }
    }

    setInspectionResult({
      fileName,
      fileType,
      extractedClasses: classNames,
      matchedNodes,
      missingNodes,
      totalNodesCount: classNames.length,
    });
  };

  const handleLoadSampleWorkflow = () => {
    setPreviewImageUrl(null);
    const sampleClasses = [
      'KSampler',
      'CheckpointLoaderSimple',
      'CLIPTextEncode',
      'IPAdapterApply',
      'DWPreprocessor',
      'FaceDetailer',
      'AnimateDiffLoaderWithContext',
      'RgthreeContext',
      'SUPIR_model_loader', // Missing!
      'CrystoolsMonitor', // Missing!
    ];
    analyzeWorkflowClasses('flux_animatediff_portrait_workflow.json', 'json', sampleClasses);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleCreateProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    onCreateProfile(newProfileName.trim(), newProfileDesc.trim());
    setNewProfileName('');
    setNewProfileDesc('');
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Workspaces & Pre-Flight (Phase 6)</span>
              <span aria-hidden="true">·</span>
              <span>Sub-2-Second Environment Switching</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Workflow Pre-Flight & Workspace Profiles
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Drop any ComfyUI <code>.png</code> generated image or <code>.json</code> workflow to identify missing nodes before launching ComfyUI. Switch workspace profiles instantly.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('preflight')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'preflight'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Pre-Flight Inspector
            </button>
            <button
              onClick={() => setActiveTab('profiles')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'profiles'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Profiles ({profiles.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'preflight' ? (
        /* Pre-Flight Workflow Inspector View */
        <div className="space-y-6">
          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-950/20'
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
              accept=".png,.json"
              className="hidden"
            />

            <div className="flex justify-center mb-3">
              <div className="p-3 rounded-full bg-slate-800/80 text-indigo-400">
                <Upload className="w-6 h-6" />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-white">
              Drop ComfyUI .png Image or .json Workflow Here
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Our binary parser reads the embedded <code>tEXt / iTXt</code> workflow chunk inside generated PNG files directly in the browser!
            </p>

            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadSampleWorkflow();
                }}
                className="px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
              >
                Load Sample Workflow (AnimateDiff + Flux + Missing Nodes)
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-xl border border-rose-800/80 bg-rose-950/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Inspection Results */}
          {inspectionResult && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
                {previewImageUrl && (
                  <div className="mb-4 pb-4 border-b border-slate-800 flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImageUrl}
                      alt="Workflow Output Preview"
                      className="w-20 h-20 object-cover rounded-lg border border-slate-700 bg-black/40 shadow-sm shrink-0"
                    />
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1">
                        Embedded PNG Image Preview
                      </span>
                      <p className="text-xs text-slate-300 font-medium">
                        Decoded from binary PNG metadata ({inspectionResult.fileName})
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Embedded ComfyUI node graph parsed from PNG text chunks.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        Workflow: {inspectionResult.fileName}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ({inspectionResult.fileType.toUpperCase()})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                      <span>Total Node Classes: {inspectionResult.totalNodesCount}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-400">
                        Installed & Ready: {inspectionResult.matchedNodes.length}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-rose-400 font-semibold">
                        Missing Dependencies: {inspectionResult.missingNodes.length}
                      </span>
                    </div>
                  </div>

                  {inspectionResult.missingNodes.length > 0 && (
                    <button
                      onClick={() =>
                        onInstallMissingNodes(
                          inspectionResult.missingNodes.map((m) => m.className)
                        )
                      }
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Install Missing Nodes for this Workflow</span>
                    </button>
                  )}
                </div>

                {/* Missing Nodes List */}
                {inspectionResult.missingNodes.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-2">
                      Missing Required Custom Nodes
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {inspectionResult.missingNodes.map((miss, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between p-3 rounded-lg border border-rose-900/60 bg-rose-950/20 text-xs"
                        >
                          <div>
                            <div className="font-mono font-semibold text-rose-200">
                              {miss.className}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {miss.suggestedRegistryNode ? (
                                <span>
                                  Provided by:{' '}
                                  <strong className="text-slate-200 font-mono">
                                    {miss.suggestedRegistryNode.name}
                                  </strong>
                                </span>
                              ) : (
                                <span>Custom node not found in curated registry</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-rose-400 uppercase font-semibold">
                            Missing
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ready / Installed Classes */}
                <div className="mt-6">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Verified Ready Classes ({inspectionResult.matchedNodes.length})
                  </h4>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden text-xs">
                    <table className="w-full text-left font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                          <th className="py-2 px-3">Class Name</th>
                          <th className="py-2 px-3">Provided By</th>
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {inspectionResult.matchedNodes.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 text-slate-200 font-semibold">
                              {m.className}
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-sans">
                              {m.nodeDisplayName} ({m.nodeFolderName})
                            </td>
                            <td className="py-2 px-3 text-right">
                              {m.enabled ? (
                                <span className="text-emerald-400 text-[11px]">
                                  ✓ Enabled
                                </span>
                              ) : (
                                <span className="text-amber-400 text-[11px]">
                                  ⚠ Disabled (.disabled)
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Workspace Profiles View */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Profiles configure which custom nodes are loaded on boot to free VRAM and speed up ComfyUI startup.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Current Setup as Profile</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profiles.map((profile) => {
              const isActive = profile.id === activeProfileId;
              const IconComponent = getProfileIcon(profile.icon);

              return (
                <div
                  key={profile.id}
                  className={`flex flex-col justify-between rounded-xl border p-5 transition-all shadow-sm ${
                    isActive
                      ? 'border-indigo-500/80 bg-indigo-950/20'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            {profile.name}
                          </h3>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Updated: {profile.updatedAt}
                          </div>
                        </div>
                      </div>

                      {isActive && (
                        <span className="text-[11px] font-mono font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                      {profile.description}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-800/60">
                      <div className="text-[11px] text-slate-500 font-medium mb-1.5">
                        Active Node Folders ({profile.targetNodeFolders.length}):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {profile.targetNodeFolders.map((f) => (
                          <span
                            key={f}
                            className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex justify-end">
                    {isActive ? (
                      <span className="text-xs text-slate-500 font-medium">
                        Currently Applied
                      </span>
                    ) : (
                      <button
                        onClick={() => onSwitchProfile(profile.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                      >
                        <span>Activate Profile</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">
              Save Current Setup as Workspace Profile
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Snapshot currently enabled custom nodes into a dedicated profile preset.
            </p>

            <form onSubmit={handleCreateProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Profile Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SD3.5 Low Memory"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes on memory usage, target models, etc."
                  value={newProfileDesc}
                  onChange={(e) => setNewProfileDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
