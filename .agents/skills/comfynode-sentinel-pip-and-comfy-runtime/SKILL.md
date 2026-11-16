---
name: comfynode-sentinel-pip-and-comfy-runtime
description: >-
  Workflows and safety patterns for ComfyNode Sentinel's sequential FIFO pip
  queue, Torch Shield interceptor, pip snapshots, managed ComfyUI process
  lifecycle, live GPU/WebSocket telemetry, and safe server-side filesystem/exec
  routes. Use when modifying dependency installation, ComfyUI process control,
  telemetry, or app/api/ routes.
---

# ComfyNode Sentinel — Pip Queue & ComfyUI Runtime

## 1. Sequential FIFO Pip Queue & Torch Shield
- **Core Modules**:
  - `lib/torch-shield.ts` — scans `requirements.txt` lines for `torch`, `torchvision`, `torchaudio`, or `xformers` before execution.
  - `lib/pip-snapshot.ts` & `app/api/env/pip-snapshot/route.ts` — captures and diffs Python environment snapshots (`pip freeze`).
  - `components/views/TerminalRunnerView.tsx` & `app/page.tsx` — manages the FIFO queue and user resolution (`strip_torch` vs `allow_torch`).
- **Implementation Rules**:
  1. Route every `pip install` trigger (Registry install, Git URL clone, Workflow missing-node install, Lockfile reconciliation) through the single-worker FIFO queue so concurrent `pip` processes never lock `site-packages`.
  2. Run the Torch Shield scan before executing `pip`; pause with `blocked_by_shield` when matched unless the user explicitly resolves it.
  3. Persist queue state via `StorageService.setPipQueue` (note: `StorageService.getPipQueue` marks interrupted `running` items as `failed` on reload).

## 2. Managed ComfyUI Process & Live Telemetry
- **Core Modules**:
  - `lib/comfy-process.ts` & `app/api/comfy/process/route.ts` — starts, stops, restarts, and tails logs for `main.py --port <comfyPort>`.
  - `lib/comfy-telemetry.ts` & `app/api/comfy/telemetry/route.ts` — polls ComfyUI HTTP/WebSocket endpoints and GPU/VRAM telemetry.
  - `lib/tauri-bridge.ts` (`nativeSyncTrayStatus`) — mirrors ComfyUI status and VRAM summary to the desktop system tray tooltip.
- **Implementation Rules**:
  1. Respect `settings.comfyPort` (default `8188`) consistently across process launch, telemetry polling, and header links.
  2. When adding tray actions (e.g., `tray-toggle-comfy`), handle both `app/page.tsx` event listeners and Rust tray menu events in `src-tauri/src/lib.rs`.

## 3. Server Filesystem & Dual-Mode Client Bridge
- **Core Modules**:
  - `lib/server-fs.ts` — `resolveSafeSubpath(baseDir, ...segments)` (prevents path traversal), `expandHomeDir()` via `getRuntimeHomeDir()` (safe for `@vercel/nft` on Windows CI).
  - `lib/system-client.ts` & `lib/tauri-bridge.ts` — client helpers that prefer Tauri IPC when `isTauriEnvironment()` is true and fall back to Next.js API routes (`/api/environment`, `/api/environment/pick`, `/api/nodes/scan`, `/api/nodes/action`, `/api/exec`).
- **Verification**:
  - Run `npx vitest run tests/torch-shield.test.ts tests/pip-snapshot.test.ts tests/comfy-telemetry.test.ts tests/api-routes.test.ts`.
  - Run `npm run build` whenever `lib/server-fs.ts` or `app/api/**` changes.
