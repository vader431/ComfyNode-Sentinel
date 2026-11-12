# ComfyNode Sentinel — Engineering TODO & Roadmap Checklist

## Completed Milestones (Phases 0–7)

### Phase 0: Scaffolding & Setup Wizard
- [x] Initialize modular application architecture with TypeScript, Tailwind CSS v4, and persistent storage (`StorageService`).
- [x] Build ComfyUI Root Path validator checking for `main.py` and `custom_nodes/`.
- [x] Implement Python Binary Auto-Detection (`python_embeded/python.exe`, `.venv/`, system `PATH`) with manual binary path override.

### Phase 1: Local Inspector & Visual Telemetry
- [x] Scan installed repositories in `custom_nodes/` with Git origin URL, branch, and short commit hash extraction.
- [x] Implement atomic directory state toggling (`Folder` $\leftrightarrow$ `Folder.disabled`).
- [x] Implement safe node uninstallation to recoverable Trash Quarantine (`trashNodes`).
- [x] Add **Storage Usage** header summary component summing `sizeMb` in `MB` / `GB`.
- [x] Add interactive **Category Composition Mini Pie Chart** with **Count** vs **Size (MB)** toggle, dynamic donut-core hover telemetry, and click-to-filter table synchronization.
- [x] Add ranked **Disk Space Usage per Repository** mini bar chart with Top 5 / Show All toggle.

### Phase 2: Command Runner & Dependency Shield
- [x] Build streaming terminal output console with command execution and abort controls.
- [x] Implement single-worker sequential FIFO `pip` installation queue.
- [x] Implement the **"Torch Shield"** pre-install scanner to intercept and strip `torch`, `torchvision`, `torchaudio`, and `xformers` from `requirements.txt`.

### Phase 3: Ingestion Channels (Registry, URL, Batch)
- [x] Build Curated Community Registry browser with search, category filter, and installed state cross-referencing.
- [x] Build Direct Git URL Clone modal with optional branch/tag and custom folder name inputs.
- [x] Build Batch `nodes.txt` URL importer with comment stripping (`#`) and duplicate filtering.
- [x] Implement upstream update checker and batch "Update All" queue integration.

### Phase 4: Portability & Sync (The Lockfile Engine)
- [x] Define and generate deterministic `comfy-lock.json` lockfiles and plain `urls.txt` lists.
- [x] Build 3-Way Reconciliation Diff Engine (`install_missing`, `checkout_commit`, `toggle_state`, `unlisted_local`).
- [x] Build interactive Reconciliation Plan Preview & 1-click execution pipeline.

### Phase 5: Virtual Names & The "Health Doctor"
- [x] Implement non-destructive virtual display aliases (`aliases.json`) and Clean vs. Real Folder Name toggle.
- [x] Build Batch Folder Normalizer (`ComfyUI-[Name]`) with compatibility warnings.
- [x] Build Python AST/Regex Health Doctor scanning for `from custom_nodes.<folder>`, Windows backslashes (`\\`), and hardcoded host paths.
- [x] Build 1-Click Python Auto-Patcher converting self-imports to relative imports and path strings to `os.path.join()`.

### Phase 6: Workspace Profiles & Pre-Flight Workflow Inspector
- [x] Build instant Workspace Profile switcher (*Flux Dev*, *Video & AnimateDiff*, *SDXL Production*, *Minimal Core*) and custom profile creator.
- [x] Build in-browser binary `.png` chunk parser (`tEXt`/`iTXt`) and `.json` workflow parser extracting required ComfyUI node classes.
- [x] Cross-reference required workflow classes against installed and registry nodes with 1-click missing node installation.

### Phase 7: Exporters, Rules, Skill & Documentation
- [x] Build Multi-Platform Issue Exporter for GitHub CLI (`gh issue create` `.sh`), Linear (`.csv`), and Notion/GitHub Markdown (`.md`).
- [x] Generate Project Engineering Rules (`/RULES.md`), Agent Skill (`/SKILL.md`), Technical Documentation (`/DOCUMENTATION.md`), and Changelog (`/CHANGELOG.md`).

---

## Upcoming Backlog (Phase 8: Post-1.0 Enhancements)

- [x] **Native Tauri Desktop Bridge Integration**:
  - [x] Wire Rust atomic state toggling (`Folder.disabled`), trash soft-quarantine, and directory validation to frontend state.
- [x] **Conflict Matrix Detector**:
  - [x] Cross-compare Python package version constraints (e.g., `numpy<2.0` vs `numpy>=2.0`, `opencv-python` vs `opencv-python-headless`) across all enabled custom nodes simultaneously.
  - [x] Integrate interactive matrix switcher and resolution cards into the Health Doctor view.
- [x] **Cloud Pod Sync (RunPod / Vast.ai / Modal)**:
  - [x] Generate idempotent `bootstrap.sh` provisioner script from `comfy-lock.json` with headless Torch Shield protection.
  - [x] Add Cloud Pod tab to Lockfile view with 1-click script download and bash 1-liner copy.

- [x] **Studio UI & UX Overhaul**:
  - [x] Build persistent bottom Studio `StatusBar` with real-time ComfyUI path, active profile, Tauri/Web bridge indicator, and error tally.
  - [x] Modernize `Header` with streamlined responsive badges and active runtime indicators.
  - [x] Upgrade `InspectorView` with multi-select batch toggling/quarantine, column header sorting, and slide-over Node Details Drawer.
  - [x] Enhance `TerminalRunnerView` with in-terminal live log search filter and split before/after Torch Shield diff visualizer.
  - [x] Upgrade `ProfilesView` with binary PNG output thumbnail preview and workflow extraction card.
- [ ] **Model Checkpoint & LoRA Symlink Manager**:
  - [ ] Scan `models/checkpoints/`, `models/loras/`, and `models/controlnet/` for orphaned or duplicate safetensors files.
  - [ ] Estimate VRAM requirements per workflow before launching ComfyUI.
- [ ] **Automated Git Bisect Assistant for Broken Updates**:
  - [ ] Allow 1-click rollback to the previous working commit hash stored in local transaction history when an upstream node update fails at runtime.
