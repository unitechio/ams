import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'dist');
const target = resolve(root, 'server', 'web', 'dist');

if (!existsSync(source)) {
  console.error('Frontend dist folder not found. Run a frontend build first.');
  process.exit(1);
}

mkdirSync(target, { recursive: true });
for (const entry of readdirSync(target)) {
  rmSync(resolve(target, entry), { recursive: true, force: true });
}

cpSync(source, target, { recursive: true });
console.log(`Synced frontend bundle from ${source} to ${target}`);
