---
name: comfynode-sentinel-nodes-models-and-workflows
description: >-
  Domain engineering guide for ComfyNode Sentinel's custom node lifecycle,
  conflict detection, comfy-lock.json 3-way reconciliation, model deduplication,
  binary PNG workflow parsing, and static Python Health Doctor linting. Use
  when modifying node management, lockfiles, models, PNG inspection, or health
  linting.
---

# ComfyNode Sentinel — Nodes, Models & Workflows

## 1. Custom Node Lifecycle, Conflicts & Transactions
- **Core Modules**:
  - `app/api/nodes/scan/route.ts` & `app/api/nodes/action/route.ts` (and native Rust commands `scan_custom_nodes`, `toggle_node_state`, `quarantine_node_to_trash` in `src-tauri/src/lib.rs`).
  - `lib/conflict-detector.ts` — detects overlapping node classes/conflicts across installed custom nodes.
  - `lib/transaction-history.ts` — records update/install/rollback transactions via `StorageService`.
- **Invariants**:
  1. Toggle enabled/disabled state strictly via directory rename (`<Folder>` ↔ `<Folder>.disabled`).
  2. Quarantine uninstalled nodes to OS Trash / `.sentinel_trash` instead of destructive deletion.
  3. Treat the real `custom_nodes/` filesystem as the source of truth (do not cache node lists in `localStorage`).

## 2. 3-Way Lockfile Reconciliation (`comfy-lock.json`)
- **Core Modules**: `lib/lockfile.ts`, `components/views/LockfileView.tsx`.
- **Reconciliation States**:
  - `install_missing` — present in lockfile, absent locally → queue `git clone` + `git checkout <commit_hash>`.
  - `checkout_commit` — commit hash differs → queue `git fetch && git checkout <commit_hash>`.
  - `toggle_state` — commit matches, enabled state differs → rename `<Folder>` ↔ `<Folder>.disabled`.
  - `unlisted_local` — present locally, absent from lockfile → prompt user (`keep` | `disable` | `uninstall`).

## 3. Model Manager & Deduplication
- **Core Modules**: `lib/model-manager.ts`, `app/api/models/scan/route.ts`, `app/api/models/deduplicate/route.ts`, `components/views/ModelsView.tsx`.
- **Invariants**:
  - Validate all model paths under the configured ComfyUI root using `resolveSafeSubpath` before scanning, hashing, or deduplicating.

## 4. Binary PNG Workflow Parsing & Python Health Doctor
- **Binary PNG Metadata (`lib/png-metadata.ts`, `components/views/ProfilesView.tsx`)**:
  - Parse actual PNG chunks (`tEXt` and `iTXt` after the `89 50 4E 47 0D 0A 1A 0A` signature) using `Uint8Array` / `DataView` to extract embedded `workflow` / `prompt` JSON.
- **Python Health Doctor (`lib/health-linter.ts`, `components/views/HealthDoctorView.tsx`)**:
  - Every `autoFixable: true` `HealthIssue` must have a deterministic patch in `autoPatchPythonCode()` that preserves indentation and valid Python syntax.
- **Verification**:
  - Run `npx vitest run tests/conflict-detector.test.ts tests/lockfile.test.ts tests/model-manager.test.ts tests/png-metadata.test.ts tests/health-linter.test.ts tests/transaction-history.test.ts`.
