import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assetsDirectory = join(process.cwd(), 'dist', 'assets');
const scripts = readdirSync(assetsDirectory)
  .filter(file => file.endsWith('.js'))
  .map(file => ({ file, bytes: statSync(join(assetsDirectory, file)).size }));
const largest = scripts.reduce((current, item) => item.bytes > current.bytes ? item : current, { file: '', bytes: 0 });
const totalBytes = scripts.reduce((sum, item) => sum + item.bytes, 0);
const kib = bytes => (bytes / 1024).toFixed(1);

if (largest.bytes > 350 * 1024) throw new Error(`Largest JavaScript chunk ${largest.file} is ${kib(largest.bytes)} KiB; budget is 350 KiB.`);
if (totalBytes > 850 * 1024) throw new Error(`Total JavaScript is ${kib(totalBytes)} KiB; budget is 850 KiB.`);
console.log(`Bundle budget passed: largest ${largest.file} ${kib(largest.bytes)} KiB; total ${kib(totalBytes)} KiB across ${scripts.length} lazy chunks.`);
