import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const sidecarOnly = process.argv.includes('--sidecar-only');
const nextDir = path.join(root, '.next');
const standaloneSrc = path.join(nextDir, 'standalone');
const staticSrc = path.join(nextDir, 'static');
const publicSrc = path.join(root, 'public');
const destDir = path.join(root, 'src-tauri', 'standalone-server');

function stageNodeSidecar() {
  function resolveTargetTriple() {
    if (process.env.TAURI_ENV_TARGET_TRIPLE) {
      return process.env.TAURI_ENV_TARGET_TRIPLE;
    }
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
    if (process.platform === 'win32') return `${arch}-pc-windows-msvc`;
    if (process.platform === 'darwin') return `${arch}-apple-darwin`;
    return `${arch}-unknown-linux-gnu`;
  }

  const triple = resolveTargetTriple();
  const ext = triple.includes('windows') ? '.exe' : '';
  const binariesDir = path.join(root, 'src-tauri', 'binaries');
  const sidecarDest = path.join(binariesDir, `node-${triple}${ext}`);
  const nodeSource = process.env.NODE_SIDECAR_PATH || process.execPath;

  fs.mkdirSync(binariesDir, { recursive: true });
  fs.copyFileSync(nodeSource, sidecarDest);
  if (!ext) {
    fs.chmodSync(sidecarDest, 0o755);
  }
  console.log(`[prepare-desktop] Staged Node.js sidecar: ${path.relative(root, sidecarDest)}`);
}

stageNodeSidecar();
if (sidecarOnly) {
  process.exit(0);
}

console.log('[prepare-desktop] Cleaning previous build artifacts...');
fs.rmSync(nextDir, { recursive: true, force: true });
fs.rmSync(destDir, { recursive: true, force: true });

// Remove any orphaned legacy files if the project archive was extracted over an older checkout
const legacyFiles = [
  'components/ExportModal.tsx',
  'components/views/RoadmapView.tsx',
  'components/views/DocsView.tsx',
  'lib/issue-exporter.ts',
  'lib/utils.ts',
  'tests/issue-exporter.test.ts',
  'hooks/use-mobile.ts',
  '.eslintrc.json',
];
for (const relPath of legacyFiles) {
  const fullPath = path.join(root, relPath);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { force: true });
    console.log(`[prepare-desktop] Removed stale legacy file: ${relPath}`);
  }
}

console.log('[prepare-desktop] Running Next.js standalone build...');
execSync('npm run build', {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production' },
});

if (!fs.existsSync(standaloneSrc)) {
  throw new Error(`Missing .next/standalone at ${standaloneSrc}`);
}

console.log('[prepare-desktop] Staging standalone server into src-tauri/standalone-server...');
fs.cpSync(standaloneSrc, destDir, { recursive: true, dereference: true });

if (fs.existsSync(staticSrc)) {
  const staticDest = path.join(destDir, '.next', 'static');
  fs.mkdirSync(path.dirname(staticDest), { recursive: true });
  fs.cpSync(staticSrc, staticDest, { recursive: true, dereference: true });
}

if (fs.existsSync(publicSrc)) {
  const publicDest = path.join(destDir, 'public');
  fs.cpSync(publicSrc, publicDest, { recursive: true, dereference: true });
}

console.log('[prepare-desktop] Standalone server ready.');

