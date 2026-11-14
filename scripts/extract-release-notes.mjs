import fs from 'fs';
import path from 'path';

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
const changelogPath = path.join(root, 'CHANGELOG.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const rawArg = process.argv[2] || process.env.RELEASE_VERSION || pkg.version;
const version = rawArg.replace(/^v/i, '');
const outFile = process.argv[3] || 'RELEASE_NOTES.md';

let notes = '';

if (fs.existsSync(changelogPath)) {
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startRegex = new RegExp(`^## \\[${escaped}\\][^\\r\\n]*\\r?\\n`, 'm');
  const startMatch = startRegex.exec(changelog);
  if (startMatch) {
    const rest = changelog.slice(startMatch.index + startMatch[0].length);
    const nextHeading = rest.search(/^## \[/m);
    const section = nextHeading !== -1 ? rest.slice(0, nextHeading) : rest;
    notes = section.replace(/\r?\n---\s*$/, '').trim();
  }
}

if (!notes) {
  notes = `Release v${version} of ComfyNode Sentinel.\n\nSee [CHANGELOG.md](./CHANGELOG.md) for full details.`;
}

fs.writeFileSync(path.resolve(root, outFile), `${notes}\n`, 'utf8');
console.log(`[release-notes] Wrote release notes for v${version} to ${outFile}`);
