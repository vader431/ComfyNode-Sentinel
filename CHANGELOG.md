# Changelog

All notable changes to **ComfyNode Sentinel** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-11-12

### Added
- **Interactive Category Composition Mini Pie Chart (`InspectorView`)**:
  - Added custom SVG vector donut chart visualizing installed custom nodes by `category`.
  - Added **Count** vs **Size (MB)** metric toggle to inspect ecosystem balance by either repository count or disk space footprint.
  - Added dynamic donut-core hover telemetry displaying exact percentage share, category name, and node count / MB size.
  - Added bidirectional click-to-filter synchronization between pie slices, category legend cards, and the main node inventory table.
- **Header Storage Usage Summary Component (`InspectorView`)**:
  - Added dedicated header badge summing `sizeMb` across all installed repositories with automatic `MB` / `GB` unit scaling.
- **Project Rules, Agent Skill & Documentation Suite**:
  - Added `/RULES.md` (`/generate-rules`) defining architectural invariants, React 19 purity standards, and ComfyUI domain safety rules.
  - Added `/SKILL.md` (`/generate-skill`) providing structured agent instructions for extending ComfyNode Sentinel.
  - Added `/DOCUMENTATION.md`, `/CHANGELOG.md`, and `/TODO.md` alongside in-app tabs in `DocsView` with copy and download support.

---

## [1.1.0] - 2026-11-12

### Added
- **Inspector KPI Strip & Disk Space Bar Chart (`InspectorView`)**:
  - Added 4-column executive KPI strip tracking Total Storage Footprint, Installed Repositories, Health Compliance, and Pending Updates.
  - Added ranked horizontal Disk Space Usage per Repository mini bar chart with **Top 5** vs **All** toggle.
- **In-App Documentation & Progress Console (`DocsView`)**:
  - Added interactive phase progress cards linking directly to each operational console.
  - Added Tauri v2 Rust IPC command reference and `comfy-lock.json` schema documentation.

### Fixed
- **React 19 Compiler & ESLint Purity Compliance**:
  - Refactored state hydration in `app/page.tsx` to use lazy `useState` initializers and `useSyncExternalStore`.
  - Moved queue ID generation (`createQueueId`) to module scope to satisfy `react-hooks/purity`.
  - Derived `shieldActivePendingItem` directly from `pipQueue` in `TerminalRunnerView.tsx` to eliminate cascading `useEffect` state updates.

---

## [1.0.0] - 2026-11-11

### Added
- **Phase 0 — Scaffolding & Environment Setup Wizard (`SettingsView`)**:
  - ComfyUI root path validator (`main.py` and `custom_nodes/` verification).
  - Multi-tier Python binary detector (`python_embeded/python.exe`, `venv`, system `PATH`) with manual override.
- **Phase 1 — Local Inspector (`InspectorView`)**:
  - Installed custom node table with Git origin, branch, commit hash copy, and status badges.
  - Instant atomic state toggling (`<Folder>` $\leftrightarrow$ `<Folder>.disabled`) and recoverable Trash Bin quarantine.
- **Phase 2 — Command Runner & "Torch Shield" (`TerminalRunnerView`)**:
  - Real-time PTY log output terminal with process abort controls.
  - Single-worker sequential FIFO `pip` installation queue.
  - Interactive **Torch Shield** intercepting `torch`, `torchvision`, `torchaudio`, and `xformers` overwrites in `requirements.txt`.
- **Phase 3 — Multi-Channel Ingestion (`RegistryView`)**:
  - Curated ComfyUI community registry browser with live search and category filtering.
  - Direct Git URL clone modal and batch `nodes.txt` URL importer with deduplication.
- **Phase 4 — Portability & Lockfile Engine (`LockfileView`)**:
  - `comfy-lock.json` and `urls.txt` exporters.
  - 3-way reconciliation diff engine comparing imported lockfiles against local nodes.
- **Phase 5 — Virtual Aliases & "Health Doctor" (`HealthDoctorView`)**:
  - Virtual display name overrides (`aliases.json`) and batch Folder Normalizer (`ComfyUI-[Name]`).
  - Static Python AST/regex linter and 1-click auto-patcher for hardcoded imports and Windows backslash paths.
- **Phase 6 — Workspace Profiles & Pre-Flight Workflow Inspector (`ProfilesView`)**:
  - Instant workspace profile switcher (*Flux Dev*, *Video & AnimateDiff*, *SDXL Production*, *Minimal Core*).
  - In-browser binary PNG chunk parser (`tEXt`/`iTXt`) and `.json` workflow dependency resolver.
- **Phase 7 — Packaging & Multi-Platform Issue Exporters (`ExportModal`, `RoadmapView`)**:
  - Interactive Phase 0–7 engineering checklist with custom task creation.
  - Automated exporters for **GitHub CLI (`.sh`)**, **Linear (`.csv`)**, and **Notion / GitHub Markdown (`.md`)**.
