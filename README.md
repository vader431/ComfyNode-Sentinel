# ComfyNode Sentinel — Standalone ComfyUI Custom Nodes Manager

> Standalone desktop and web companion for managing ComfyUI custom nodes, dependencies, models, and environment health. Built with Next.js 15 App Router (standalone Node.js API routes for real filesystem, `git`, `pip`, and process streaming) and Tauri v2 (Rust desktop shell).

---

## ✨ Key Features

- **Desktop App Shell**: Compact `48px` top utility bar with live connection status, Torch Shield indicator, Rescan, Launch ComfyUI, `220px` grouped left navigation rail (**Core**, **Diagnostics**, **System**), non-blocking toast notifications, and a collapsible Console quick-peek drawer.
- **First-Run Onboarding**: Guided ComfyUI folder setup card when `comfyRoot` is not yet configured on disk.
- **Installed Nodes Inspector**: Real `custom_nodes/` disk scanning, git commit/branch extraction, atomic enable/disable (`Folder` ↔ `Folder.disabled`), `.sentinel_trash` soft-quarantine & restore, Folder Normalizer, and collapsible Storage Charts.
- **Install & Browse**: Curated community registry, direct `git clone --depth 1` via URL/branch, and batch URL import.
- **Updates & Rollback**: Parallelized `git fetch` remote checking, live progress bar, `Last Updated` tracking, single-node and batch `git pull`, and 1-click `git checkout` rollback history.
- **Command Runner & "Torch Shield"**: Real streaming `child_process.spawn` NDJSON console with Abort support, strict FIFO sequential `pip` queue, and automatic detection/stripping of `torch` / `torchvision` / `torchaudio` overrides.
- **Health Doctor & Conflict Matrix**: Reads and auto-patches real `.py` files on disk for hardcoded paths and broken cross-imports, and detects conflicting `requirements.txt` constraints across installed nodes.
- **Missing Nodes & Profiles**: Binary PNG/JSON workflow metadata decoder that resolves missing node classes against the community registry, plus workspace profile switching on disk.
- **Models & VRAM Studio**: Scans `models/{checkpoints,loras,controlnet,vae,upscale_models}` with fast partial SHA-256 fingerprinting, replaces duplicate weights with OS symlinks, and estimates workflow VRAM.
- **Sync & Backup**: `comfy-lock.json` export/import and real 3-way reconciliation on disk.

---

## 🛠️ Technical Architecture

### 1. Backend & Desktop Strategy
* **Standalone Server API (`app/api/*`)**:
  * `/api/environment` — Validates `main.py`, `custom_nodes/`, and detects embedded/venv/system Python.
  * `/api/nodes/scan` — Scans `custom_nodes/` & `.sentinel_trash/`, reads `requirements.txt`, and lints `.py` files.
  * `/api/nodes/action` — Executes real `toggle`, `uninstall`, `restore`, `normalize`, `clone`, `check_updates`, `update`, `rollback`, `read_file`, and `patch_file`.
  * `/api/models/scan` & `/api/models/deduplicate` — Fast partial SHA-256 duplicate detection and OS symlink creation.
  * `/api/exec` — Streams real `pip` and shell command output as NDJSON with `AbortSignal` support.
* **Desktop Shell**: Tauri v2 (`src-tauri/`) with native Windows/macOS/Linux bundling and official Sentinel Node Shield icons (`app/icon.svg`, `src-tauri/icons/`).

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

### 7. Issue Exporters (GitHub CLI, Linear, Notion)
Instantly export all roadmap tasks across Phase 0 to Phase 7:
* **GitHub CLI Script (`.sh`):** Executable bash script creating color labels and populated issues via `gh issue create`.
* **Linear CSV (`.csv`):** Importable into Linear Workspace Settings $\to$ Import $\to$ CSV.
* **Notion Markdown (`.md`):** Formatted with collapsible phase headers, priority markers, and `- [ ]` interactive checkboxes.

---

## 💻 Rust IPC Command Schema (Tauri v2)

```rust
// Environment & Discovery
#[tauri::command]
async fn validate_comfy_root(path: String) -> Result<ComfyRootValidation, String>;

#[tauri::command]
async fn detect_python_binary(comfy_path: String) -> Result<PythonEnvInfo, String>;

// Node Inspection & State Toggles
#[tauri::command]
async fn scan_installed_nodes(custom_nodes_path: String) -> Result<Vec<InstalledNode>, String>;

#[tauri::command]
async fn toggle_node_state(folder_name: String, enable: bool) -> Result<(), String>;

#[tauri::command]
async fn uninstall_node(folder_name: String) -> Result<(), String>;

// Dependency Engine
#[tauri::command]
async fn run_pip_install(node_name: String, requirements: Vec<String>, strip_torch: bool) -> Result<(), String>;

// Normalizer
#[tauri::command]
async fn batch_normalize_folders(replacements: Vec<FolderRenamePair>) -> Result<(), String>;
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

# Run Tauri desktop app (requires Rust toolchain)
npx tauri dev
```
