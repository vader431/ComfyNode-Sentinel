# Changelog

All notable changes to **ComfyNode Sentinel** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] - 2026-11-13

### Added
- **Multi-Instance ComfyUI Manager**:
  - Register, name, switch, and remove multiple ComfyUI installations (per-instance root, Python binary, and server port) via a Header quick-switcher and a Settings instance manager, with automatic migration from existing settings.
  - Launch/status/Open UI controls now follow the per-instance port.
- **System Tray & Minimize-to-Tray (Tauri v2)**:
  - Tray icon with Show / Hide to Tray / Quit, left-click toggle, and a **Minimize to System Tray on Close** preference.
- **In-App Update Check**:
  - Added `tauri-plugin-updater` and `tauri-plugin-process` with a **Check Updates** control in Settings and a GitHub Releases API fallback.
- **macOS CI Builds**:
  - Added `aarch64-apple-darwin` and `x86_64-apple-darwin` targets to the GitHub release workflow.

### Fixed
- **GitLab CI**: Disabled updater artifact signing by default (`createUpdaterArtifacts: false`) so Linux packaging no longer fails without `TAURI_SIGNING_PRIVATE_KEY`.

---

## [0.3.0] - 2026-11-13

### Added
- **Native Folder & Binary Picker (`tauri-plugin-dialog`)**:
  - Added **Browse…** buttons in `OnboardingCard` and `SettingsView` to select the ComfyUI root directory and Python executable via native OS dialogs in desktop mode.
- **Managed ComfyUI Process Lifecycle (`/api/comfy/process`)**:
  - Added detached background ComfyUI process management with PID tracking, port `8188` TCP readiness detection, **Stop** / **Restart** / **Open UI** controls in `Header`, and live stdout/stderr log tailing.
- **Python `pip` Snapshot & Drift Diff (`/api/env/pip-snapshot`)**:
  - Added **Pip Snapshot & Drift** sub-tab in `HealthDoctorView` to capture baseline `pip list --format=json` snapshots and highlight added, removed, and changed packages (with critical ML package badges).
- **Live ComfyUI-Manager Registry Sync (`/api/registry/sync`)**:
  - Added **Sync Registry** in `RegistryView` to fetch and cache upstream `custom-node-list.json` and `extension-node-map.json` with offline fallback.
- **Bundled Node.js Sidecar (`externalBin`) & Linux CI Packaging**:
  - Updated `scripts/prepare-desktop.mjs`, `src-tauri/tauri.conf.json`, and `src-tauri/src/lib.rs` to bundle the Node.js runtime sidecar directly inside desktop installers, making `.deb`, `.rpm`, `.AppImage`, and Windows installers self-contained.
  - Added GitHub Actions (`.github/workflows/release.yml`) and GitLab CI/CD (`.gitlab-ci.yml`) pipelines for Linux and Windows release artifacts.
  - Added `~` / `~/...` home directory expansion (`expandHomeDir`) and `~/ComfyUI` quick-path preset for Linux/macOS onboarding.
- **API Route Integration Tests**:
  - Added `tests/api-routes.test.ts` and `tests/pip-snapshot.test.ts` verifying environment validation, node scanning/actions, model duplicate hashing, and `pip` drift diffing.

---

## [0.2.0] - 2026-11-13

### Added
- **Desktop App Shell & Official Branding**:
  - Redesigned UI into a desktop app shell with a `48px` top utility bar (`Header`), `220px` grouped navigation rail (`Sidebar`), first-run onboarding card, collapsible Inspector storage charts, non-blocking toast notifications, and a quick-peek Console drawer.
  - Added the official **Sentinel Node Shield** app icon across web (`app/icon.svg`, `public/logo.svg`, `components/SentinelLogo.tsx`) and Tauri desktop (`src-tauri/icons/`).
  - Added version badges (`v0.2.0`) in the header and sidebar sourced from `package.json`.
- **Standalone Tauri v2 Desktop Packaging**:
  - Added `npm run tauri:dev` and `npm run tauri:build` scripts, `scripts/prepare-desktop.mjs`, and `src-tauri/loading/index.html` to bundle Next.js standalone output into `.msi` and `-setup.exe` Windows installers.
- **Dedicated Updates & Rollback View**:
  - Added a dedicated Updates & Rollback sub-tab with per-node status, single-node/batch `git pull`, `Last Updated` column, and a live progress bar during repository checks and updates.

### Changed & Improved
- **Real Backend APIs & Performance**:
  - Replaced mock data with real `/api/environment`, `/api/nodes/scan`, `/api/nodes/action`, `/api/models/scan`, `/api/models/deduplicate`, and `/api/exec` routes.
  - Parallelized git update checks, capped terminal log storage, memoized the Health Doctor linter, and removed the duplicate Updates sub-tab inside Install & Browse.
- **Status Bar Cleanup**:
  - Removed the active `Profile:` indicator from the bottom status bar (`components/StatusBar.tsx`).

### Security
- Resolved all 11 `npm audit` vulnerabilities (10 moderate, 1 high) via `postcss` update and `package.json` `overrides` (`minimatch`, `postcss`, `postcss-selector-parser`) with 0 remaining vulnerabilities.

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
