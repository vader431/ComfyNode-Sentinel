import { HealthIssue, HealthStatus } from '@/types';

export interface LintAnalysisResult {
  status: HealthStatus;
  issues: HealthIssue[];
  linesAnalyzed: number;
  fixedCode?: string;
  fixCount: number;
}

/**
 * Static Python linter for ComfyUI custom node code.
 * Analyzes code for hardcoded imports, OS path separators, and absolute user paths.
 */
export function lintPythonNodeCode(
  code: string,
  fileName: string = 'node_entry.py'
): LintAnalysisResult {
  const issues: HealthIssue[] = [];
  const lines = code.split('\n');

  lines.forEach((lineText, index) => {
    const lineNum = index + 1;
    const trimmed = lineText.trim();

    // Skip empty lines and full comments
    if (!trimmed || trimmed.startsWith('#')) return;

    // Check 1: Hardcoded self/cross imports: from custom_nodes.<folder> or import custom_nodes.<folder>
    const hardcodedImportMatch = lineText.match(
      /(?:from|import)\s+custom_nodes\.([a-zA-Z0-9_\-]+)(?:\.([a-zA-Z0-9_\.]+))?\s*(?:import\s+(.*))?/
    );
    if (hardcodedImportMatch) {
      const folder = hardcodedImportMatch[1];
      const rest = hardcodedImportMatch[2] ? `.${hardcodedImportMatch[2]}` : '';
      const importedItems = hardcodedImportMatch[3] ? ` import ${hardcodedImportMatch[3]}` : '';

      issues.push({
        id: `issue-import-${lineNum}`,
        rule: 'hardcoded_import',
        title: 'Hardcoded Module Path (`custom_nodes`)',
        description: `Importing from "custom_nodes.${folder}" fails if user renames the folder or installs in isolated environment.`,
        file: fileName,
        line: lineNum,
        snippet: lineText.trim(),
        patchable: true,
        suggestedPatch: `from .${rest ? rest.slice(1) : ''}${importedItems}`.replace('..', '.'),
      });
    }

    // Check 2: Windows-only backslash path separator concatenation
    // E.g.: folder + "\\" + "file" or folder + "\\\\" + "file" or path.split('\\')
    const windowsPathMatch = lineText.match(/(?:['"]\\\\['"]|['"]\\['"]|\+\s*['"]\\\\?.*?['"])/);
    if (windowsPathMatch && (lineText.includes('+') || lineText.includes('split') || lineText.includes('join'))) {
      issues.push({
        id: `issue-path-${lineNum}`,
        rule: 'windows_path',
        title: 'Windows-Only Path Separator',
        description: 'Hardcoded backslash "\\" path separator breaks on Linux, macOS, and containerized Docker ComfyUI.',
        file: fileName,
        line: lineNum,
        snippet: lineText.trim(),
        patchable: true,
        suggestedPatch: 'Use os.path.join() or pathlib.Path() for cross-platform filesystem paths.',
      });
    }

    // Check 3: Absolute local paths (e.g. C:\Users\... or /home/username/ or C:/Users)
    const absolutePathMatch = lineText.match(
      /(?:['"][a-zA-Z]:\\\\[uU]sers\\\\[^'"]+['"]|['"][a-zA-Z]:\/[uU]sers\/[^'"]+['"]|['"]\/home\/[a-zA-Z0-9_\-]+\/[^'"]+['"])/
    );
    if (absolutePathMatch) {
      issues.push({
        id: `issue-abs-${lineNum}`,
        rule: 'absolute_path',
        title: 'Host-Locked Absolute Path',
        description: `Contains hardcoded developer file path: "${absolutePathMatch[0]}". Fails on every other machine.`,
        file: fileName,
        line: lineNum,
        snippet: lineText.trim(),
        patchable: true,
        suggestedPatch: 'Use relative paths anchored to os.path.dirname(__file__) or ComfyUI model directories.',
      });
    }
  });

  // Calculate status
  let status: HealthStatus = 'compliant';
  if (issues.some((i) => i.rule === 'absolute_path')) {
    status = 'os_locked';
  } else if (issues.length > 0) {
    status = 'fragile';
  }

  return {
    status,
    issues,
    linesAnalyzed: lines.length,
    fixCount: issues.filter((i) => i.patchable).length,
  };
}

/**
 * Auto-patches Python node code to fix hardcoded custom_nodes imports
 * and common Windows path concatenation anti-patterns.
 */
export function autoPatchPythonCode(code: string): { patchedCode: string; changesCount: number } {
  let changesCount = 0;
  const lines = code.split('\n');

  const patchedLines = lines.map((line) => {
    // 1. Convert "from custom_nodes.<anything>.<submodule> import <items>" to "from .<submodule> import <items>"
    const fromMatch = line.match(/^(\s*)from\s+custom_nodes\.[a-zA-Z0-9_\-]+(\.[a-zA-Z0-9_\.]+)?\s+import\s+(.*)$/);
    if (fromMatch) {
      changesCount++;
      const indent = fromMatch[1];
      const submodule = fromMatch[2] ? fromMatch[2] : '';
      const items = fromMatch[3];
      return `${indent}from .${submodule ? submodule.slice(1) : ''} import ${items}`.replace('..', '.');
    }

    // 2. Convert simple `+ "\\\\" +` or `+ "\\"` into os.path.join pattern
    if (line.includes(' + "\\\\" + ') || line.includes(' + "\\" + ')) {
      const replaced = line
        .replace(/([a-zA-Z0-9_]+)\s*\+\s*["'](?:\\\\|\\)["']\s*\+\s*([a-zA-Z0-9_"'()]+)/g, 'os.path.join($1, $2)');
      if (replaced !== line) {
        changesCount++;
        return replaced;
      }
    }

    return line;
  });

  return {
    patchedCode: patchedLines.join('\n'),
    changesCount,
  };
}
