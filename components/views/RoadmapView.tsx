'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Search,
  Filter,
  Plus,
  Share2,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  Sparkles,
} from 'lucide-react';
import { RoadmapTask, PhaseId } from '@/types';

interface RoadmapViewProps {
  tasks: RoadmapTask[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: RoadmapTask) => void;
  onOpenExportModal: () => void;
}

export function RoadmapView({
  tasks,
  onToggleTask,
  onAddTask,
  onOpenExportModal,
}: RoadmapViewProps) {
  const [selectedPhase, setSelectedPhase] = useState<PhaseId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPhase, setNewPhase] = useState<PhaseId>('phase-1');
  const [newPriority, setNewPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');

  // Stats
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / (totalCount || 1)) * 100);

  const phases: { id: PhaseId; title: string; short: string }[] = [
    { id: 'phase-0', title: 'Phase 0: Scaffolding & Setup Wizard', short: 'P0 Setup' },
    { id: 'phase-1', title: 'Phase 1: Local Inspector (MVP)', short: 'P1 Inspector' },
    { id: 'phase-2', title: 'Phase 2: Runner & Torch Shield', short: 'P2 Shield' },
    { id: 'phase-3', title: 'Phase 3: Ingestion & Registry', short: 'P3 Ingest' },
    { id: 'phase-4', title: 'Phase 4: Lockfile & Sync', short: 'P4 Lockfile' },
    { id: 'phase-5', title: 'Phase 5: Names & Health Doctor', short: 'P5 Doctor' },
    { id: 'phase-6', title: 'Phase 6: Profiles & Workflows', short: 'P6 Profiles' },
    { id: 'phase-7', title: 'Phase 7: Packaging & Release', short: 'P7 Release' },
  ];

  // Filtering
  const filteredTasks = tasks.filter((task) => {
    if (selectedPhase !== 'all' && task.phaseId !== selectedPhase) return false;
    if (statusFilter === 'pending' && task.completed) return false;
    if (statusFilter === 'completed' && !task.completed) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description.toLowerCase().includes(q);
      const matchLabels = task.githubLabels.some((l) => l.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchLabels) return false;
    }
    return true;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const matchedPhase = phases.find((p) => p.id === newPhase);
    const newTask: RoadmapTask = {
      id: `task-custom-${Date.now()}`,
      phaseId: newPhase,
      phaseTitle: matchedPhase ? matchedPhase.title : 'Phase 1: Local Inspector',
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom roadmap item.',
      completed: false,
      category: 'core',
      githubLabels: ['custom', newPhase],
      linearPriority: newPriority,
    };

    onAddTask(newTask);
    setNewTitle('');
    setNewDesc('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Progress Overview */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>ComfyUI Desktop App Build Backlog</span>
              <span aria-hidden="true">·</span>
              <span>Linear & GitHub Sync Ready</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1">
              Architecture & Execution Roadmap
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Track progress from Phase 0 scaffolding through the Torch Shield runner, Lockfile sync,
              Health Doctor, and cross-platform packaging.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>

            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Export Issues</span>
            </button>
          </div>
        </div>

        {/* Global Progress Strip */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>Overall Roadmap Completion</span>
            <span className="text-slate-200 font-semibold tabular-nums">
              {completedCount} / {totalCount} Tasks ({progressPercent}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Phase selector tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedPhase('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              selectedPhase === 'all'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Phases ({totalCount})
          </button>
          {phases.map((p) => {
            const count = tasks.filter((t) => t.phaseId === p.id).length;
            const isDone = tasks.filter((t) => t.phaseId === p.id && t.completed).length === count;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPhase(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  selectedPhase === p.id
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{p.short}</span>
                {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* Search & Status Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                statusFilter === 'pending' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Todo
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                statusFilter === 'completed' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <Filter className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-300">No tasks found</p>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search query or phase filter.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            return (
              <div
                key={task.id}
                className={`group rounded-lg border transition-colors ${
                  task.completed
                    ? 'border-slate-800/60 bg-slate-900/30 text-slate-400'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className="mt-0.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-medium tracking-tight ${
                            task.completed ? 'line-through text-slate-500' : 'text-slate-100'
                          }`}
                        >
                          {task.title}
                        </span>

                        <span className="text-xs text-slate-500">
                          {task.phaseTitle.split(':')[0]}
                        </span>
                        <span aria-hidden="true" className="text-slate-700">·</span>
                        <span className="text-xs text-slate-500 font-mono">
                          {task.linearPriority}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {task.description}
                      </p>

                      {/* Labels */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                        {task.githubLabels.map((lbl) => (
                          <span key={lbl} className="font-mono text-[11px] text-slate-400">
                            #{lbl}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.technicalDetails && (
                      <button
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        className="p-1 text-slate-500 hover:text-slate-300 rounded"
                        title="View technical details"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && task.technicalDetails && (
                  <div className="px-4 pb-4 pt-1 text-xs border-t border-slate-800/60 bg-slate-950/40">
                    <div className="text-slate-400 font-medium mb-1">Architecture Implementation:</div>
                    <code className="block p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-indigo-300 leading-relaxed">
                      {task.technicalDetails}
                    </code>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4">Add Custom Roadmap Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement multi-threaded tarball unpacker"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Explain requirements, safety constraints, or IPC details..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phase</label>
                  <select
                    value={newPhase}
                    onChange={(e) => setNewPhase(e.target.value as PhaseId)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.short}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) =>
                      setNewPriority(e.target.value as 'Urgent' | 'High' | 'Medium' | 'Low')
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
