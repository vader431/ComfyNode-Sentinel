# ComfyNode Sentinel — ComfyUI Node Manager & Desktop Companion

> Production-grade desktop companion and custom node management suite for ComfyUI. Built with Tauri v2 (Rust async runtime) architecture and a Next.js 15 App Router web console with offline inspection, FIFO pip dependency queuing, the "Torch Shield", 3-way lockfile reconciliation (`comfy-lock.json`), and static Python AST health linting.

---

## 📊 Implementation Progress Tracker

| Phase | Milestone | Scope & Deliverables | Status | Completion |
| :--- | :--- | :--- | :---: | :---: |
| **Phase 0** | **Scaffolding & Setup Wizard** | Environment auto-detection (`main.py`, `custom_nodes/`), Python binary discovery (Windows Portable `python_embeded`, venv, system `PATH`), and settings persistence. | ✅ Done | **100%** |
| **Phase 1** | **Local Inspector (Offline MVP)** | Disk scan, git commit/branch extraction, instant state toggle (`Folder` $\leftrightarrow$ `Folder.disabled`), safe trash quarantine, and high-density inventory table. | ✅ Done | **100%** |
| **Phase 2** | **Command Runner & Shield** | PTY streaming terminal log runner, single-threaded FIFO pip queue, and the interactive **"Torch Shield"** interceptor preventing PyTorch overwrites. | ✅ Done | **100%** |
| **Phase 3** | **Ingestion Channels** | Curated community registry (25+ nodes), direct Git clone modal with branch overrides, batch URL importer (`nodes.txt`), and batch update runner. | ✅ Done | **100%** |
| **Phase 4** | **Lockfile & Sync Engine** | `comfy-lock.json` generator & parser, plain `urls.txt` exporter, and 3-way reconciliation engine (clone missing, checkout commits, toggle states). | ✅ Done | **100%** |
| **Phase 5** | **Names & Health Doctor** | Virtual display names (`aliases.json`), Folder Normalizer tool (`ComfyUI-[Name]`), and Python static AST linter with 1-click auto-patcher. | ✅ Done | **100%** |
| **Phase 6** | **Profiles & Pre-Flight** | Sub-2-second workspace profiles ("Flux & High VRAM", "AnimateDiff", "Portrait Master") and binary PNG chunk decoder extracting embedded ComfyUI workflows. | ✅ Done | **100%** |
| **Phase 7** | **Packaging & Issue Exporter** | Cross-platform abstractions, persistent error logging, and automated issue provisioners for GitHub CLI (`gh`), Linear CSV, and Notion Markdown. | ✅ Done | **100%** |

---

## 🛠️ Technical Architecture

### 1. App Shell & Backend Strategy
* **App Shell:** Tauri v2 (Rust `tokio` async runtime).
* **Process Management:** `tokio::process::Command` streaming lines to frontend via Tauri event channel `app.emit("log-output", { id, line })`.
* **Filesystem Safety:** Atomic directory renaming for state toggles and soft-quarantine utilizing the `trash` crate.
* **Persistent Preferences:** `tauri-plugin-store` serializing user configurations into `settings.json` and `aliases.json`.

### 2. Frontend Layer
* **Framework:** Next.js 15+ App Router, React 19, TypeScript 5.9.
* **Styling:** Tailwind CSS v4, dark-slate UI aesthetic following high-density SaaS dashboard specifications.
* **Icons:** `lucide-react` affordance-only icons.
* **Typography:** Modern geometric sans display paired with monospace tabular figures (`font-mono tabular-nums`).

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

## 🚀 Running the Applet

```bash
# Install dependencies
npm install

# Start Next.js development server on port 3000
npm run dev

# Run compilation check
npm run build

# Run linting check
npm run lint
```
