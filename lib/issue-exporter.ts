import { RoadmapTask } from '@/types';

/**
 * Exports tasks as an executable GitHub CLI (`gh`) bash script
 */
export function exportToGitHubCliScript(tasks: RoadmapTask[]): string {
  const lines = [
    '#!/usr/bin/env bash',
    '# =====================================================================',
    '# ComfyNode Sentinel Desktop App - Automated GitHub Issues Provisioner',
    '# Generated: ' + new Date().toISOString(),
    '# Requirements: GitHub CLI (gh auth login)',
    '# =====================================================================',
    '',
    'set -e',
    '',
    'echo "🚀 Creating Phase Labels in current repository..."',
    'gh label create "phase-0" --color "6366f1" --description "Setup & Environment" --force 2>/dev/null || true',
    'gh label create "phase-1" --color "0ea5e9" --description "Local Inspector" --force 2>/dev/null || true',
    'gh label create "phase-2" --color "f59e0b" --description "Command Runner & Shield" --force 2>/dev/null || true',
    'gh label create "phase-3" --color "10b981" --description "Ingestion Channels" --force 2>/dev/null || true',
    'gh label create "phase-4" --color "8b5cf6" --description "Lockfile & Sync" --force 2>/dev/null || true',
    'gh label create "phase-5" --color "ec4899" --description "Health Doctor & Lint" --force 2>/dev/null || true',
    'gh label create "phase-6" --color "14b8a6" --description "Profiles & Workflows" --force 2>/dev/null || true',
    'gh label create "phase-7" --color "64748b" --description "Packaging & Distribution" --force 2>/dev/null || true',
    '',
    'echo "📋 Creating individual Roadmap Issues..."',
    '',
  ];

  for (const task of tasks) {
    const labelsArg = task.githubLabels.length > 0 ? `--label "${task.githubLabels.join(',')}"` : '';
    const escapedTitle = task.title.replace(/"/g, '\\"');
    const bodyContent = `### ${task.phaseTitle}\\n\\n${task.description}\\n\\n**Technical Implementation:**\\n${task.technicalDetails || 'Standard implementation'}\\n\\n**Priority:** ${task.linearPriority}\\n\\n- [ ] Acceptance Criteria Verified`;
    const escapedBody = bodyContent.replace(/"/g, '\\"');

    lines.push(`echo "Creating issue: ${escapedTitle}"`);
    lines.push(`gh issue create --title "${escapedTitle}" --body "${escapedBody}" ${labelsArg}`);
    lines.push('');
  }

  lines.push('echo "✅ All ComfyNode Sentinel issues successfully created in GitHub!"');
  return lines.join('\n');
}

/**
 * Exports tasks formatted as a structured Linear CSV file for Linear Settings -> Import -> CSV.
 */
export function exportToLinearCsv(tasks: RoadmapTask[]): string {
  const headers = ['Title', 'Description', 'Status', 'Priority', 'Labels'];
  const rows: string[] = [headers.join(',')];

  for (const task of tasks) {
    const title = `"${task.title.replace(/"/g, '""')}"`;
    const description = `"${(
      task.description +
      '\n\nPhase: ' +
      task.phaseTitle +
      '\nTechnical Note: ' +
      (task.technicalDetails || '')
    ).replace(/"/g, '""')}"`;
    const status = task.completed ? '"Done"' : '"Todo"';
    const priority = `"${task.linearPriority}"`;
    const labels = `"${task.githubLabels.join(', ')}"`;

    rows.push([title, description, status, priority, labels].join(','));
  }

  return rows.join('\n');
}

/**
 * Exports tasks as Notion-friendly hierarchical Markdown with checkboxes and callout boxes.
 */
export function exportToNotionMarkdown(tasks: RoadmapTask[]): string {
  const phases = Array.from(new Set(tasks.map((t) => t.phaseTitle)));
  const lines = [
    '# ComfyNode Sentinel - Desktop App Roadmap & Checklist',
    '> Complete end-to-end implementation backlog for ComfyUI Custom Node Manager (Tauri v2 + Rust + Tailwind).',
    '',
  ];

  for (const phase of phases) {
    const phaseTasks = tasks.filter((t) => t.phaseTitle === phase);
    lines.push(`## ${phase}`);
    lines.push('');

    for (const t of phaseTasks) {
      const check = t.completed ? '[x]' : '[ ]';
      lines.push(`- ${check} **${t.title}**`);
      lines.push(`  - Description: ${t.description}`);
      if (t.technicalDetails) {
        lines.push(`  - Tech Architecture: \`${t.technicalDetails}\``);
      }
      lines.push(`  - Priority: \`${t.linearPriority}\` | Labels: ${t.githubLabels.map((l) => `\`${l}\``).join(' ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Exports tasks as a clean GitHub Project Markdown document.
 */
export function exportToGitHubMarkdown(tasks: RoadmapTask[]): string {
  const phases = Array.from(new Set(tasks.map((t) => t.phaseTitle)));
  const lines = [
    '# ComfyNode Sentinel Implementation Roadmap',
    '',
    'Tracking issue for building the ComfyUI desktop node manager with Tauri v2 and Rust.',
    '',
  ];

  for (const phase of phases) {
    const phaseTasks = tasks.filter((t) => t.phaseTitle === phase);
    const completedCount = phaseTasks.filter((t) => t.completed).length;
    lines.push(`### ${phase} (${completedCount}/${phaseTasks.length} Done)`);
    lines.push('');

    for (const t of phaseTasks) {
      const check = t.completed ? '[x]' : '[ ]';
      lines.push(`- ${check} **${t.title}** - ${t.description}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
