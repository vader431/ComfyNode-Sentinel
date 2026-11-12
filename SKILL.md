---
name: comfynode-sentinel-engineering
description: Domain-specific engineering skill for building, extending, and auditing ComfyNode Sentinel — covering ComfyUI custom node management, the Torch Shield pip interceptor, comfy-lock.json 3-way reconciliation, binary PNG workflow parsing, and Python AST health linting.
---

# ComfyNode Sentinel Engineering Skill (`/generate-skill`)

Use this skill whenever adding features, fixing bugs, designing IPC bridges, or extending **ComfyNode Sentinel**.

---

## 1. Architecture Overview

ComfyNode Sentinel is structured into clean, decoupled layers:
- **`/types/index.ts`**: Canonical TypeScript interfaces (`InstalledNode`, `RegistryNode`, `ComfyLockfile`, `ReconciliationItem`, `HealthIssue`, `WorkspaceProfile`, `WorkflowInspectionResult`, `PipQueueItem`, `EnvironmentSettings`, `RoadmapTask`).
- **`/lib/storage.ts`**: Persistent state repository backed by browser `localStorage` (and designed for 1:1 mapping with `tauri-plugin-store`).
- **`/lib/png-metadata.ts`**: Binary PNG chunk reader (`Uint8Array` / `DataView`) that extracts `tEXt` and `iTXt` ComfyUI `workflow` and `prompt` JSON payloads without external native dependencies.
- **`/lib/health-linter.ts`**: Static Python code analyzer and automated code patcher detecting fragile `from custom_nodes.<folder>` imports, Windows backslashes (`\\`), and hardcoded host paths.
- **`/lib/lockfile.ts`**: `comfy-lock.json` generator, `urls.txt` exporter, and 3-way diff reconciliation engine.
- **`/lib/issue-exporter.ts`**: Multi-platform backlog exporter generating GitHub CLI bash scripts (`gh issue create`), Linear CSV files, and Notion Markdown checklists.
- **`/components/views/*`**: Modular view controllers (`InspectorView`, `TerminalRunnerView`, `RegistryView`, `LockfileView`, `HealthDoctorView`, `ProfilesView`, `RoadmapView`, `SettingsView`, `DocsView`).

---

## 2. Core Implementation Patterns

### Pattern A: Adding or Modifying Node Telemetry & Charts (`InspectorView`)
1. Always compute aggregate metrics via `React.useMemo` keyed on `[nodes]`.
2. Format storage values dynamically using a unified helper:
   ```ts
   const formatStorage = (mb: number): string =>
     mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
   ```
3. When adding visual charts (e.g., SVG Donut Pie Chart or Repo Bar Chart), ensure clicking a visual segment updates `categoryFilter` or `searchQuery` so the chart acts as an interactive filter for the node table.

### Pattern B: Extending the "Torch Shield" & Pip Queue (`TerminalRunnerView`)
1. Any new package ingestion channel (Registry install, Git URL clone, Batch `nodes.txt`, or Workflow missing-node install) must route through `enqueuePipInstall(nodeName, rawRequirements)`.
2. Check each requirement line against the Torch Shield matcher:
   ```ts
   const TORCH_REGEX = /^(torch|torchvision|torchaudio|xformers)(\s*[<>=!~].*)?$/i;
   ```
3. If `TORCH_REGEX` matches any line, set item status to `'blocked_by_shield'` and require explicit user resolution (`strip_torch` vs `allow_torch`) before advancing the FIFO worker queue.

### Pattern C: Extending the Python Health Doctor (`lib/health-linter.ts`)
1. Each lint rule must produce a structured `HealthIssue` containing:
   - `id`, `nodeId`, `folderName`, `file`, `line`, `severity` (`'warning'` | `'error'`), `type` (`'hardcoded_import'` | `'windows_backslash'` | `'hardcoded_path'`), `snippet`, `suggestion`, and `autoFixable`.
2. Every `autoFixable: true` rule must have a corresponding deterministic transformation in `autoPatchPythonCode(code, folderName)` that preserves indentation and valid Python syntax.

### Pattern D: 3-Way Lockfile Reconciliation (`lib/lockfile.ts`)
When comparing a target `ComfyLockfile` against `InstalledNode[]`:
- **`install_missing`**: Node exists in lockfile but not in local `custom_nodes/` $\to$ Queue `git clone` + `git checkout <commit_hash>`.
- **`checkout_commit`**: Node exists locally but `local.commitHash !== lock.commit_hash` $\to$ Queue `git fetch && git checkout <commit_hash>`.
- **`toggle_state`**: Node exists locally at matching commit, but `local.enabled !== lock.enabled_state` $\to$ Rename folder `.disabled`.
- **`unlisted_local`**: Node exists locally but is absent from the lockfile $\to$ Prompt user action (`keep` | `disable` | `uninstall`).

---

## 3. Verification Workflow
Before completing any engineering task on ComfyNode Sentinel:
1. Run Next.js production compilation (`compile_applet`) and ESLint (`lint_applet`) together.
2. Verify zero React 19 hook purity or hydration warnings.
3. Confirm all interactive state changes persist across page reloads.
