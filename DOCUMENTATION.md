# ComfyNode Sentinel — Technical Documentation

## 1. Overview
**ComfyNode Sentinel** is an offline-first desktop companion and custom node lifecycle manager for **ComfyUI**. Built on a modular Next.js 15 / React 19 frontend architecture paired with Tauri v2 (Rust) IPC command specifications, it prevents Python environment corruption, dependency lockups, and workflow portability failures.

---

## 2. System Architecture & Module Map

```text
├── app/
│   ├── globals.css              # Tailwind CSS v4 + dark studio theme & scrollbar rules
│   ├── layout.tsx               # Root layout, metadata, and typography setup
│   └── page.tsx                 # Root state orchestrator, persistence sync & modal manager
├── components/
│   ├── Header.tsx               # 3-zone top navigation bar with live badge counters
│   ├── ExportModal.tsx          # Multi-platform exporter (GitHub CLI .sh, Linear .csv, Notion .md)
│   └── views/
│       ├── InspectorView.tsx    # Node inventory, Storage Usage header, Category Pie Chart & Repo Bar Chart
│       ├── TerminalRunnerView.tsx # Streaming PTY log console, FIFO Pip Queue & Torch Shield
│       ├── RegistryView.tsx     # Community node registry browser, Git URL clone & batch nodes.txt import
│       ├── LockfileView.tsx     # comfy-lock.json exporter & 3-way reconciliation engine
│       ├── HealthDoctorView.tsx # Static Python AST/regex linter & 1-click auto-patcher
│       ├── ProfilesView.tsx     # Sub-2s workspace profile switcher & binary PNG workflow inspector
│       ├── RoadmapView.tsx      # Interactive Phase 0–7 engineering backlog & task manager
│       ├── SettingsView.tsx     # Phase 0 ComfyUI root & Python binary auto-detection wizard
│       └── DocsView.tsx         # In-app documentation, Rules, Skill, Changelog & TODO viewer
├── lib/
│   ├── default-data.ts          # Initial ComfyUI nodes, curated registry, profiles & Phase 0–7 tasks
│   ├── health-linter.ts         # Python static code scanner & automated patch generator
│   ├── issue-exporter.ts        # Generators for GitHub CLI, Linear CSV, Notion & GitHub Markdown
│   ├── lockfile.ts              # Lockfile schema builder & 3-way diff reconciliation calculator
│   ├── png-metadata.ts          # Binary PNG chunk parser (tEXt / iTXt) for ComfyUI workflows
│   └── storage.ts               # LocalStorage persistence service with safe fallback & reset
└── types/
    └── index.ts                 # Complete TypeScript data contracts
```

---

## 3. Deep-Dive Feature Reference

### 3.1 Local Inspector & Visual Telemetry (`InspectorView`)
- **Storage Usage Header Component**: Dynamically sums the `sizeMb` property across all installed repositories and formats the total in `MB` or `GB` (e.g., `263.9 MB (8 repos)`).
- **Interactive Category Composition Mini Pie Chart**:
  - SVG vector donut chart grouping installed nodes by `category` (*Preprocessors*, *Segmentation*, *Video*, *Conditioning*, *Vision*, *Image Processing*, *Core*, *Utilities*).
  - **Metric Mode Toggle**: Switch between **Count** (repository count per category) and **Size (MB)** (disk usage per category).
  - **Interactive Donut Core & Filtering**: Hovering a slice displays exact percentage share and metrics in the center; clicking a slice filters the node table below.
- **Disk Space Usage per Repo**: Ranked horizontal bar chart comparing individual repository sizes with a **Top 5 / Show All** toggle.
- **Atomic Enable/Disable Toggle**: Renames `<Folder>` $\leftrightarrow$ `<Folder>.disabled` so ComfyUI skips loading disabled nodes on startup without deleting local files or Git configuration.
- **Virtual Aliases & Folder Normalizer**: Maps cryptic repository names to clean display titles in `aliases.json` or batch-renames folders to `ComfyUI-[Name]`.

### 3.2 Command Runner, FIFO Pip Queue & "Torch Shield" (`TerminalRunnerView`)
- **Sequential FIFO Pip Queue**: Processes `pip install -r requirements.txt` jobs strictly one at a time, eliminating concurrent write collisions in `site-packages`.
- **The "Torch Shield" Interceptor**:
  - Pre-scans `requirements.txt` before spawning `pip`.
  - Flags unpinned or conflicting `torch`, `torchvision`, `torchaudio`, and `xformers` lines.
  - Prompts the user to **Strip PyTorch & Install Safe Packages (Recommended)** or **Force Install All**.

### 3.3 Ingestion Channels (`RegistryView`)
1. **Curated Registry Browser**: Search verified custom nodes by name, author, category, or provided ComfyUI node classes (`KSampler`, `IPAdapterApply`, `DWPreprocessor`, etc.).
2. **Direct Git Clone**: Clone any Git URL with optional branch/tag pinning and custom target folder naming.
3. **Batch `nodes.txt` Importer**: Paste or upload multi-line repository lists (ignoring `#` comments and already-installed URLs) to queue batch installations.

### 3.4 Portability & Lockfile Engine (`LockfileView`)
- **`comfy-lock.json` Schema**: Captures `version`, `generated_at`, `comfyui_version`, and an array of nodes with exact `name`, `url`, `commit_hash`, `branch`, and `enabled_state`.
- **3-Way Reconciliation Engine**: Compares an imported lockfile against local `custom_nodes/` and generates an actionable sync plan (`Install Missing`, `Checkout Commit`, `Toggle State`, and `Unlisted Local Node` resolution).

### 3.5 The "Health Doctor" Static Linter (`HealthDoctorView`)
- Scans Python files inside custom nodes for three portability hazards:
  1. **Hardcoded Self/Cross Imports** (`from custom_nodes.MyNode import ...`) $\to$ Breaks when folders are renamed.
  2. **Windows Backslash Separators** (`folder + "\\" + filename`) $\to$ Breaks on Linux/macOS cloud pods.
  3. **Absolute Host Paths** (`C:\Users\Admin\...`) $\to$ Fails on any other machine.
- **1-Click Auto-Patcher**: Rewrites hardcoded self-imports into relative Python imports (`from . import ...`) and converts backslash concatenations into `os.path.join()`.

### 3.6 Workspace Profiles & Pre-Flight Workflow Inspector (`ProfilesView`)
- **Sub-2-Second Profile Switching**: Activate curated node presets (*Flux.1 Dev Studio*, *AnimateDiff & Video Suite*, *SDXL Lightning Production*, *Minimal Core Safe Mode*) with a single click.
- **Pre-Flight Workflow Inspector**: Drag and drop any ComfyUI `.png` image or `.json` workflow file. The binary parser extracts embedded `tEXt`/`iTXt` JSON chunks, lists all required node class types, highlights missing or disabled custom nodes, and offers **1-Click Install Missing Nodes**.
