'use client';

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Terminal,
  FileSpreadsheet,
  FileText,
  Github,
} from 'lucide-react';
import { RoadmapTask } from '@/types';
import {
  exportToGitHubCliScript,
  exportToLinearCsv,
  exportToNotionMarkdown,
  exportToGitHubMarkdown,
} from '@/lib/issue-exporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: RoadmapTask[];
}

type ExportTab = 'gh_cli' | 'linear_csv' | 'notion_md' | 'github_md';

export function ExportModal({ isOpen, onClose, tasks }: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<ExportTab>('gh_cli');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  let exportContent = '';
  let fileName = '';
  let fileMime = 'text/plain';

  switch (activeTab) {
    case 'gh_cli':
      exportContent = exportToGitHubCliScript(tasks);
      fileName = 'create-comfynode-issues.sh';
      fileMime = 'application/x-sh';
      break;
    case 'linear_csv':
      exportContent = exportToLinearCsv(tasks);
      fileName = 'linear-comfynode-tasks.csv';
      fileMime = 'text/csv';
      break;
    case 'notion_md':
      exportContent = exportToNotionMarkdown(tasks);
      fileName = 'comfynode-roadmap-notion.md';
      fileMime = 'text/markdown';
      break;
    case 'github_md':
      exportContent = exportToGitHubMarkdown(tasks);
      fileName = 'comfynode-roadmap-github.md';
      fileMime = 'text/markdown';
      break;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportContent], { type: fileMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[88vh] rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-white">
              Export Roadmap & Checklist
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Import all {tasks.length} tasks directly into GitHub Issues, Linear, or Notion.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('gh_cli')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'gh_cli'
                ? 'bg-slate-800 text-indigo-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>GitHub CLI Script (.sh)</span>
          </button>

          <button
            onClick={() => setActiveTab('linear_csv')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'linear_csv'
                ? 'bg-slate-800 text-indigo-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Linear CSV (.csv)</span>
          </button>

          <button
            onClick={() => setActiveTab('notion_md')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'notion_md'
                ? 'bg-slate-800 text-indigo-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Notion Markdown (.md)</span>
          </button>

          <button
            onClick={() => setActiveTab('github_md')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'github_md'
                ? 'bg-slate-800 text-indigo-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-3.5 h-3.5 text-purple-400" />
            <span>GitHub Project (.md)</span>
          </button>
        </div>

        {/* Content Viewer */}
        <div className="relative flex-1 p-6 overflow-hidden flex flex-col bg-slate-950/60">
          <div className="flex items-center justify-between pb-3 text-xs text-slate-400">
            <span>
              Previewing: <strong className="font-mono text-slate-300">{fileName}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy to Clipboard</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {fileName.split('.').pop()?.toUpperCase()}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre leading-relaxed select-all">
            {exportContent}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/90 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Import instructions:</span>
            {activeTab === 'gh_cli' && (
              <span>Run <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-300">chmod +x script.sh && ./script.sh</code> in your repository.</span>
            )}
            {activeTab === 'linear_csv' && (
              <span>Navigate to Linear &gt; Workspace Settings &gt; Import &gt; CSV.</span>
            )}
            {activeTab === 'notion_md' && (
              <span>Paste directly into any Notion page or import as Markdown.</span>
            )}
            {activeTab === 'github_md' && (
              <span>Paste into a new GitHub Issue or Project Board description.</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-slate-300 hover:text-white rounded hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
