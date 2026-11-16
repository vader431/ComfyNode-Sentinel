# ComfyNode Sentinel — Standalone ComfyUI Custom Nodes Manager

> Standalone desktop and web companion for managing ComfyUI custom nodes, dependencies, models, and environment health. Built with Next.js 15 App Router (standalone Node.js API routes for real filesystem, `git`, `pip`, and process streaming) and Tauri v2 (Rust desktop shell).

---

## ✨ Key Features

- **Desktop App Shell**: Compact `48px` top utility bar with live connection status, Torch Shield indicator, Rescan, Launch ComfyUI, `220px` grouped left navigation rail (**Core**, **Diagnostics**, **System**), non-blocking toast notifications, and a collapsible Console quick-peek drawer.
- **First-Run Onboarding**: Guided ComfyUI folder setup card when `comfyRoot` is not yet configured on disk.
- **Installed Nodes Inspector**: Real `custom_nodes/` disk scanning, git commit/branch extraction, atomic enable/disable (`Folder` ↔ `Folder.disabled`), `.sentinel_trash` soft-quarantine & restore, Folder Normalizer, and collapsible Storage Charts.
- **Multi-Instance & Launch Control**: Register and switch between multiple ComfyUI installations (per-instance root, Python binary, server port, and CLI launch flags like `--lowvram` / `--fast` / `--preview-method auto`), manage the background ComfyUI process, and inspect live GPU/WebSocket telemetry.
- **Updates, Core & Frontend Manager**: Parallelized `git` remote checking, single-node/batch `git pull` (preserving update states across rescans), 1-click `git checkout` rollback history, ComfyUI Core Git updater, and a **Frontend** tab to install, update, or roll back `comfyui-frontend-package` PyPI releases.
- **Crash & Traceback Doctor**: Automatically parses ComfyUI `IMPORT FAILED`, `ModuleNotFoundError`, `custom_nodes/<folder>` tracebacks, and CUDA OOM errors in the Console with 1-click pip module installation or node disabling.
- **Install & Browse**: Curated community registry + live ComfyUI-Manager sync with **Installed** badges, direct `git clone --depth 1` via URL/branch, and batch URL import.
- **Command Runner & "Torch Shield"**: Real streaming `child_process.spawn` NDJSON console with Abort support, strict FIFO sequential `pip` queue, `pip` snapshot drift diffing, and automatic detection/stripping of `torch` / `torchvision` / `torchaudio` / `xformers` overrides.
- **Health Doctor & Conflict Matrix**: Reads and auto-patches real `.py` files on disk for hardcoded paths and broken cross-imports, and detects conflicting `requirements.txt` constraints across installed nodes.
- **Missing Nodes & Models Pre-Flight**: Binary PNG/JSON workflow metadata decoder that resolves missing node classes against the community registry and cross-references referenced checkpoints, LoRAs, ControlNets, VAEs, UNETs, and CLIPs against local `models/`.
- **Models & VRAM Studio**: Scans `models/{checkpoints,loras,controlnet,vae,upscale_models}` with fast partial SHA-256 fingerprinting, replaces duplicate weights with OS symlinks, and estimates workflow VRAM.
- **Sync & Backup**: `comfy-lock.json` export/import, Cloud Pod `bootstrap.sh` generation, and real 3-way reconciliation on disk.
- **Desktop Shell & System Tray**: Tauri v2 desktop app with bundled Node.js sidecar, native OS folder/file pickers, minimize-to-tray lifecycle, tray status tooltip sync, and in-app Release & Updater center.

---

## 🛠️ Technical Architecture

### 1. Backend & Desktop Strategy
* **Standalone Server API (`app/api/*`)**:
  * `/api/environment`, `/api/environment/core`, `/api/environment/pick` — Validates `main.py` & `custom_nodes/`, detects Python runtimes, checks/pulls ComfyUI core Git updates, and provides host OS directory/file pickers.
  * `/api/nodes/scan` & `/api/nodes/action` — Scans `custom_nodes/` & `.sentinel_trash/`, reads `requirements.txt`, lints `.py` files, and executes `toggle`, `uninstall`, `restore`, `normalize`, `clone`, `check_updates`, `update`, `rollback`, `read_file`, and `patch_file`.
  * `/api/comfy/process` & `/api/comfy/telemetry` — Spawns/stops/restarts managed ComfyUI with per-instance CLI flags, tails logs, and polls live GPU/VRAM/WebSocket queue telemetry.
  * `/api/env/pip-snapshot`, `/api/env/frontend`, `/api/registry/sync` — Captures `pip` freeze snapshots & drift diffs, manages `comfyui-frontend-package` PyPI versions, and syncs upstream ComfyUI-Manager registries.
  * `/api/models/scan` & `/api/models/deduplicate` — Fast partial SHA-256 duplicate detection and OS symlink creation.
  * `/api/exec` — Streams real `pip` and shell command output as NDJSON with `AbortSignal` support.
* **Desktop Shell**: Tauri v2 (`src-tauri/`) with bundled Node.js sidecar, system tray & minimize-to-tray, native Windows/macOS/Linux installers, and official Sentinel Node Shield icons (`app/icon.svg`, `src-tauri/icons/`).

### 2. Frontend Layer
* **Framework**: Next.js 15 App Router (`output: 'standalone'`), React 19, TypeScript 5.
* **Styling**: Tailwind CSS v4, dark-slate studio aesthetic (`#070a10` / `#0b0f17`), `lucide-react` icons, and `font-mono tabular-nums` metrics.

---

## 🚀 Core Features & Workflows

### 1. The "Torch Shield" (Phase 2 Dependency Protection)
Overwriting PyTorch inside a ComfyUI installation destroys CUDA acceleration, xformers, and torch runtime compilation.
* **Interception Mechanism:** Inspects incoming `requirements.txt` before spawning `pip`.
* **Detection Rules:** Flags lines matching `torch`, `torchvision`, or `torchaudio`.
* **Resolution Prompt:** Prompts user: *"This node tries to overwrite PyTorch. Strip it from install? [Yes (Recommended) / No]"*.
* **Sanitization:** Automatically strips risky packages while preserving other dependencies (e.g. `transformers`, `einops`, `scipy`).

### 2. Sequential Pip Queue (Strict FIFO)
To eliminate Windows site-packages lockup crashes and race conditions, the execution queue processes dependency installations in strict serial order:
```
[Node A Requirements] ──> [Single Worker Worker Channel] ──> [Node B Requirements]
                                      │
                         Ensures zero file locks
```

### 3. Portability & Sync: The Lockfile Engine (`comfy-lock.json`)
The lockfile schema captures reproducible environments for team workstations and cloud GPU instances (RunPod, Vast.ai, Modal):
```json
{
  "version": "1.0.0",
  "generated_at": "2026-11-12T01:37:18.000Z",
  "comfyui_version": "v0.3.18-cu124",
  "nodes": [
    {
      "name": "ComfyUI-Impact-Pack",
      "url": "https://github.com/ltdrdata/ComfyUI-Impact-Pack.git",
      "commit_hash": "4f2b10a",
      "branch": "main",
      "enabled_state": true
    }
  ]
}
```
* **3-Way Reconciliation:**
  - **Missing Locally:** Queued for `git clone --depth 1` + checkout pinned hash.
  - **Commit Drift:** Queued for `git checkout <pinned_commit>`.
  - **State Mismatch:** Renamed atomically `Folder` $\leftrightarrow$ `Folder.disabled`.
  - **Unlisted Local Nodes:** Flagged for user decision (Keep / Disable / Delete).

### 4. The "Health Doctor" (Static Python AST Linter)
Detects structural anti-patterns before launching ComfyUI:
1. `from custom_nodes.<folder>`: Hardcoded self/cross imports that break on folder renaming or in isolated environments.
2. Windows-only backslashes: `folder + "\\" + file` that fail on Linux and macOS.
3. Hardcoded developer paths: `C:\Users\Developer\...` that crash on other workstations.
* **Auto-Patcher Tool:** 1-click button that automatically refactors self-imports to relative `from . import ...` syntax and converts path concatenation to `os.path.join`.

### 5. Pre-Flight Workflow Inspector
Drag and drop `.png` images generated by ComfyUI or raw `.json` workflows:
* **Binary PNG Chunk Parser:** Scans PNG bytes for `tEXt` and `iTXt` metadata chunks containing embedded workflow JSON.
* **Class Extraction:** Parses node graphs to extract required class types (e.g. `KSampler`, `DWPreprocessor`, `IPAdapterApply`, `AnimateDiffLoaderWithContext`).
* **Dependency Matching:** Cross-references against installed nodes and community database to identify missing nodes.
* **1-Click Remediation:** "Install Missing Nodes for this Workflow" enqueues missing custom node repositories into the installer pipeline.

### 6. Storage Usage & Inspector Visualizations
* **Storage Usage Component:** Calculates and renders the sum of all `sizeMb` fields from installed nodes, formatted dynamically in **GB** or **MB** (e.g. `263.9 MB`).
* **Category Distribution Mini Pie Chart:** Interactive SVG donut pie chart breaking down installed nodes by `category` with a metric toggle (`Count` vs `Size (MB)`), dynamic donut-core hover statistics, slice scaling, and instant table filter synchronization upon clicking any slice.
* **Disk Space Usage per Repo:** Ranked mini bar chart visualizing the storage footprint of each installed custom node repository, complete with "Top 5" vs "Show All" toggle.

## 💻 Rust IPC Command Schema (Tauri v2)

```rust
// Environment & Discovery
#[tauri::command]
fn check_environment(comfy_root: String) -> Result<EnvironmentCheckResult, String>;

#[tauri::command]
fn get_desktop_runtime_info(app: tauri::AppHandle) -> Result<DesktopRuntimeInfo, String>;

#[tauri::command]
async fn pick_directory(app: tauri::AppHandle, title: Option<String>) -> Result<Option<String>, String>;

#[tauri::command]
async fn pick_file(app: tauri::AppHandle, title: Option<String>) -> Result<Option<String>, String>;

// Node Inspection & Safe State Operations
#[tauri::command]
fn scan_custom_nodes(custom_nodes_path: String) -> Result<Vec<DiscoveredNode>, String>;

#[tauri::command]
fn toggle_node_state(custom_nodes_path: String, folder_name: String) -> Result<String, String>;

#[tauri::command]
fn quarantine_node_to_trash(custom_nodes_path: String, folder_name: String) -> Result<(), String>;

// System Tray & Window Lifecycle
#[tauri::command]
fn set_minimize_to_tray(state: tauri::State<'_, MinimizeToTrayState>, enabled: bool);

#[tauri::command]
fn sync_tray_status(state: tauri::State<'_, TrayHandleState>, status_label: String, vram_summary: Option<String>) -> Result<(), String>;
```

---

## 🚀 Running the App

```bash
# Install dependencies
npm install

# Start Next.js development server on port 3000
npm run dev

# Run unit tests (Vitest)
npm test

# Run typecheck & linting
npx tsc --noUnusedLocals --noUnusedParameters --noEmit
npm run lint

# Build production standalone bundle
npm run build

# Run Tauri desktop app in dev mode (requires Rust toolchain)
npm run tauri:dev

# Build standalone Tauri desktop installers (.msi / -setup.exe)
npm run tauri:build
```
