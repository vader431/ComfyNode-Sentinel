import type {
  DesktopRuntimeInfo,
  EnvironmentSettings,
  InstalledNode,
  TerminalLogEntry,
} from '@/types';

export interface DiagnosticBundleInput {
  appVersion: string;
  isTauri: boolean;
  desktopInfo: DesktopRuntimeInfo | null;
  settings: EnvironmentSettings;
  installedNodes: InstalledNode[];
  logs: TerminalLogEntry[];
  generatedAt?: string;
}

/**
 * Redacts OS usernames from Windows and POSIX home directory paths so
 * diagnostic reports can be shared safely in bug reports.
 */
export function redactUserPaths(input: string): string {
  return input
    .replace(/([A-Za-z]:\\Users\\)([^\\/\s"']+)/gi, '$1<user>')
    .replace(/(\/home\/)([^/\s"']+)/gi, '$1<user>')
    .replace(/(\/Users\/)([^/\s"']+)/gi, '$1<user>');
}

export function buildDiagnosticsMarkdown(input: DiagnosticBundleInput): string {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const enabledCount = input.installedNodes.filter((n) => n.enabled).length;
  const disabledCount = input.installedNodes.length - enabledCount;
  const nodesWithIssues = input.installedNodes.filter((n) => n.healthIssues.length > 0);
  const recentErrors = input.logs
    .filter((l) => l.type === 'stderr' || l.type === 'warn' || l.type === 'shield')
    .slice(-50);

  const lines: string[] = [
    `# ComfyNode Sentinel Diagnostic Bundle`,
    `- **Generated At**: ${generatedAt}`,
    `- **App Version**: v${input.appVersion}`,
    `- **Runtime Shell**: ${input.isTauri ? 'Tauri v2 Desktop' : 'Next.js Standalone Web'}`,
    ...(input.desktopInfo
      ? [
          `- **OS / Arch**: ${input.desktopInfo.os} (${input.desktopInfo.arch})`,
          `- **Bundled Node Sidecar**: ${input.desktopInfo.hasBundledNode ? 'Yes' : 'No'}`,
        ]
      : []),
    ``,
    `## Environment`,
    `- **ComfyUI Root**: \`${redactUserPaths(input.settings.comfyRoot || 'unset')}\``,
    `- **Python Binary**: \`${redactUserPaths(input.settings.pythonBinary || 'python')}\` (${input.settings.pythonType})`,
    `- **ComfyUI Port**: ${input.settings.comfyPort || 8188}`,
    `- **Launch Flags**: \`${(input.settings.launchArgs || []).join(' ') || '(none)'}\``,
    `- **Torch Shield**: ${input.settings.autoTorchShield ? 'Enabled' : 'Disabled'}`,
    ``,
    `## Custom Nodes (${input.installedNodes.length} total: ${enabledCount} enabled, ${disabledCount} disabled)`,
    `- **Nodes with Health Doctor issues**: ${nodesWithIssues.length}`,
    ...input.installedNodes.slice(0, 60).map(
      (n) =>
        `  - \`${n.folderName}\` (${n.enabled ? 'enabled' : 'disabled'}) — \`${n.branch}@${n.currentCommit || 'unknown'}\``
    ),
    ``,
    `## Recent Warnings & Errors (${recentErrors.length})`,
    ...(recentErrors.length === 0
      ? ['(none)']
      : recentErrors.map((e) => `- [${e.timestamp}] [${e.type}] ${redactUserPaths(e.text)}`)),
  ];

  return lines.join('\n');
}
