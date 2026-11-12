# ComfyNode Sentinel — Project Engineering & AI Rules (`/generate-rules`)

## 1. Core Architectural Identity
- **Application Name**: ComfyNode Sentinel (ComfyUI Custom Node Manager & Desktop Companion)
- **Web / Companion Stack**: Next.js 15+ (App Router), React 19, TypeScript 5.9, Tailwind CSS v4, Lucide React
- **Desktop Shell Target**: Tauri v2 (Rust async runtime via `tokio`, `serde`, `tauri-plugin-store`, `trash`, `reqwest`, `regex`/`ignore`)
- **Primary Mission**: Eliminate ComfyUI environment corruption by enforcing sequential dependency installation, PyTorch overwrite protection ("Torch Shield"), reproducible `comfy-lock.json` lockfiles, static Python AST linting, and non-destructive node toggling.

---

## 2. Strict Anti-Simulation & Code Quality Rules
1. **Zero Truncation Policy**: Never use `// TODO`, `// implement logic here`, or partial file placeholders. Every function, parser, state transition, and UI modal must be implemented end-to-end.
2. **Real Data Persistence**: All state mutations (roadmap tasks, installed nodes, trash bin, virtual aliases, workspace profiles, environment settings, and pip queue items) must persist immediately to `StorageService` (`localStorage` / `tauri-plugin-store`) and survive reloads.
3. **Binary & AST Parsing Authenticity**:
   - PNG workflow inspection must parse actual binary PNG chunks (`tEXt` and `iTXt` after the 8-byte signature `89 50 4E 47 0D 0A 1A 0A`).
   - Python health linting must evaluate real line-by-line regex/AST patterns and produce deterministic, syntactically valid Python patches.
4. **React 19 Compiler & Purity Compliance**:
   - **No Impure Render Calls**: Never invoke `Date.now()` or `Math.random()` inside component render bodies. Move ID and timestamp generation to module-level helpers called inside event handlers.
   - **No Synchronous `setState` in `useEffect`**: Initialize persistent state via lazy `useState(() => StorageService.get...())` initializers and use `useSyncExternalStore` for client hydration detection.

---

## 3. Domain Safety Invariants (ComfyUI Specific)
1. **Atomic Node State Toggling**:
   - Enabling or disabling a custom node must **never** delete files or modify `.git` history.
   - State changes are strictly performed via atomic directory renaming: `custom_nodes/<Folder>` $\leftrightarrow$ `custom_nodes/<Folder>.disabled`.
2. **Single-Worker FIFO Pip Queue**:
   - Never spawn concurrent `pip install` processes against the same Python environment (`python_embeded` or `venv`), as concurrent writes cause `Access is denied` lockups in `site-packages` on Windows.
   - All dependency installations must pass through the sequential FIFO queue.
3. **The "Torch Shield" Mandatory Pre-Check**:
   - Every `requirements.txt` file must be scanned for `^(torch|torchvision|torchaudio|xformers)(\s*[<>=!~].*)?$` before `pip` execution.
   - When detected, execution must pause (`status: 'blocked_by_shield'`) and prompt the user to strip PyTorch packages (Recommended) or force-allow.
4. **Safe Deletion via System Trash**:
   - Uninstalling a node must move the directory to the recoverable Trash quarantine (`trash` crate / `trashNodes` store) rather than running destructive `rm -rf`.

---

## 4. UI, Visual & Typographic Discipline
1. **Dark-First Technical Precision**:
   - Maintain a high-contrast slate/obsidian palette (`bg-slate-950`, `bg-slate-900/60`, `border-slate-800`) tailored for technical studio workflows.
2. **Tabular Numeric Alignment**:
   - All metrics, disk sizes (`MB` / `GB`), commit hashes, line numbers, and percentages must use `font-mono` and `tabular-nums`.
3. **Top Bar Contract**:
   - Keep the navigation bar clean with 3 distinct zones: Brand Wordmark, Single-Line View Navigation with live item counters, and 1 Primary Action CTA (`Export Roadmap`).
4. **Interactive Data Visualizations**:
   - Charts in `InspectorView` (such as the Category Composition SVG Donut Pie Chart and Disk Space Usage Bar Chart) must remain interactive, supporting metric toggling (`Count` vs `Size (MB)`) and click-to-filter synchronization with the underlying inventory table.
