import { describe, it, expect } from 'vitest';
import {
  exportToGitHubCliScript,
  exportToLinearCsv,
  exportToNotionMarkdown,
} from '@/lib/issue-exporter';
import { RoadmapTask } from '@/types';

const mockTasks: RoadmapTask[] = [
  {
    id: 'task-1',
    phaseId: 'phase-1',
    phaseTitle: 'Phase 1: Local Inspector',
    title: 'Implement SVG Donut Chart',
    description: 'Category distribution breakdown with count and size metrics.',
    completed: true,
    category: 'frontend',
    githubLabels: ['phase-1', 'ui'],
    linearPriority: 'High',
    technicalDetails: 'Pure SVG trigonometric arc generator',
  },
  {
    id: 'task-2',
    phaseId: 'phase-2',
    phaseTitle: 'Phase 2: Torch Shield',
    title: 'PyTorch Overwrite Interceptor',
    description: 'Intercept pip install commands attempting to replace torch.',
    completed: false,
    category: 'security',
    githubLabels: ['phase-2', 'security'],
    linearPriority: 'Urgent',
    technicalDetails: 'Regex scanner for requirements.txt',
  },
];

describe('issue-exporter', () => {
  it('exports valid GitHub CLI script with labels and issue commands', () => {
    const script = exportToGitHubCliScript(mockTasks);
    expect(script).toContain('#!/usr/bin/env bash');
    expect(script).toContain('gh label create "phase-1"');
    expect(script).toContain('gh issue create --title "Implement SVG Donut Chart"');
    expect(script).toContain('gh issue create --title "PyTorch Overwrite Interceptor"');
  });

  it('exports valid Linear CSV format with proper quotes and headers', () => {
    const csv = exportToLinearCsv(mockTasks);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Title,Description,Status,Priority,Labels');
    expect(csv).toContain('"Implement SVG Donut Chart"');
    expect(csv).toContain('"Done"');
    expect(csv).toContain('"PyTorch Overwrite Interceptor"');
    expect(csv).toContain('"Todo"');
    expect(csv).toContain('"Urgent"');
  });

  it('exports Notion hierarchical markdown with checkboxes', () => {
    const md = exportToNotionMarkdown(mockTasks);
    expect(md).toContain('# ComfyNode Sentinel - Desktop App Roadmap & Checklist');
    expect(md).toContain('## Phase 1: Local Inspector');
    expect(md).toContain('- [x] **Implement SVG Donut Chart**');
    expect(md).toContain('## Phase 2: Torch Shield');
    expect(md).toContain('- [ ] **PyTorch Overwrite Interceptor**');
  });
});

