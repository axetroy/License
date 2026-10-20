import { cp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';

await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await cp(new URL('../playground/index.html', import.meta.url), new URL('../dist/index.html', import.meta.url));
await cp(new URL('../playground/style.css', import.meta.url), new URL('../dist/style.css', import.meta.url));
await build({
  entryPoints: [new URL('../playground/app.js', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  outfile: new URL('../dist/app.js', import.meta.url).pathname,
  minify: true,
});
