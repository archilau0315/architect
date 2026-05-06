import { createHash } from 'crypto';
import { readdirSync, statSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'deploy', 'local-file-manifest.txt');

function hash(f) {
  return createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
}

function scanDir(base, type) {
  const results = [];
  if (!existsSync(base)) return results;
  function walk(dir, rel) {
    try {
      for (const f of readdirSync(dir)) {
        const fp = join(dir, f);
        const r = rel ? `${rel}/${f}` : f;
        const st = statSync(fp);
        if (st.isDirectory()) {
          if (f !== 'node_modules' && !f.startsWith('.') && f !== 'deploy') walk(fp, r);
        } else {
          const ext = f.split('.').pop().toLowerCase();
          if (['html', 'js', 'css', 'mjs', 'json'].includes(ext)) {
            results.push({ type, path: r, kb: Math.round(st.size / 1024), mod: st.mtime.toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(' ', '_'), h: hash(fp) });
          }
        }
      }
    } catch {}
  }
  walk(base, '');
  return results;
}

console.log('Scanning dist/ (frontend build) ...');
const feFiles = scanDir(join(ROOT, 'dist'), 'frontend');
console.log('Scanning backend/ ...');
const beFiles = scanDir(join(ROOT, 'backend'), 'backend');

let txt = 'TYPE | PATH | SIZE_KB | MODIFIED | HASH\n-----|------|---------|----------|-----\n';
for (const f of [...feFiles, ...beFiles]) {
  txt += `${f.type.padEnd(8)} | ${f.path.padEnd(55)} | ${String(f.kb).padStart(7)} | ${f.mod.padEnd(19)} | ${f.h}\n`;
}
writeFileSync(OUT, txt, 'utf-8');

console.log(`\nfrontend(dist): ${feFiles.length} files`);
console.log(`backend       : ${beFiles.length} files`);
console.log(`total         : ${feFiles.length + beFiles.length} files`);
console.log(`Saved: ${OUT}`);
