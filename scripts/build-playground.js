import { cp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const output = new URL('../docs/public/playground/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../playground/index.html', import.meta.url), new URL('index.html', output));
await cp(new URL('../playground/style.css', import.meta.url), new URL('style.css', output));
await build({
  entryPoints: [new URL('../playground/app.js', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  outfile: new URL('app.js', output).pathname,
  minify: true,
});
