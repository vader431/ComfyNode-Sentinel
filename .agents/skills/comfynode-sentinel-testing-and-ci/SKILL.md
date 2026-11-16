---
name: comfynode-sentinel-testing-and-ci
description: >-
  Verification, Vitest testing, Next.js standalone build tracing, ESLint, and
  GitHub Actions / GitLab CI troubleshooting guide for ComfyNode Sentinel. Use
  when writing tests, debugging build/lint/CI failures, or modifying workflow
  files.
---

# ComfyNode Sentinel — Testing & CI/CD Verification

## 1. Local Verification Suite
Run these checks before completing any change:

- **TypeScript, Lint, Unit Tests, Production Build**:
  ```powershell
  npx tsc --noEmit
  npm run lint
  npm test
  npm run build
  ```
- **Rust / Tauri Checks** (whenever `src-tauri/` changes):
  ```powershell
  cargo check --manifest-path src-tauri/Cargo.toml --all-targets
  cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
  cargo test --manifest-path src-tauri/Cargo.toml
  ```

## 2. Vitest Test Suite (`tests/`)
Configured via `vitest.config.mts`. Current test coverage spans:
- `tests/api-routes.test.ts` — Next.js API route handlers
- `tests/torch-shield.test.ts` & `tests/pip-snapshot.test.ts` — dependency safety & snapshots
- `tests/comfy-telemetry.test.ts` — ComfyUI telemetry parsing
- `tests/conflict-detector.test.ts` & `tests/transaction-history.test.ts` — node conflicts & history
- `tests/lockfile.test.ts` & `tests/model-manager.test.ts` — reconciliation & model deduplication
- `tests/png-metadata.test.ts` & `tests/health-linter.test.ts` — binary PNG & Python linting
- `tests/storage-instances.test.ts` — `StorageService` multi-instance persistence

## 3. Common Build & CI Pitfalls
1. **Windows CI `EPERM: scandir 'C:\Users\runneradmin\Application Data'` during `next build`**:
   - Caused by `@vercel/nft` statically evaluating `path.join(os.homedir(), ...)` into a wildcard glob. Keep `getRuntimeHomeDir()` in `lib/server-fs.ts` (reads `process.env.HOME || process.env.USERPROFILE` first).
2. **`Cannot find module '@tauri-apps/cli-win32-x64-msvc'` on Windows CI**:
   - Caused by a single-OS `package-lock.json` missing optional platform bindings. Never regenerate `package-lock.json` on one OS without preserving multi-platform optional dependencies.
3. **`tauri-action` trying to use `bun`**:
   - Because `bun.lock` exists in the repo, `.github/workflows/release.yml` must keep `tauriScript: npx tauri`.
4. **GitHub Actions Node 20 Deprecation Warning**:
   - Keep `actions/checkout@v7` and `actions/setup-node@v7` (`node24`) in `.github/workflows/ci.yml` and `.github/workflows/release.yml`.
5. **GitLab CI Invalid YAML (`cache:key:files has too many items`)**:
   - `.gitlab-ci.yml` `cache:key:files` must list at most **2** files.
6. **ESLint Failing on Staged Desktop Artifacts**:
   - `eslint.config.mjs` must ignore `.next/**`, `out/**`, `dist-web/**`, `src-tauri/**`, and `node_modules/**`.
