#!/usr/bin/env node
/**
 * Bundles the extension's autofill engine for the Playwright runner:
 *   dist/autofill/autofill.iife.js  - injected into pages (window.AutoApplyEngine)
 *   dist/autofill/autofill.cjs      - required by Node scripts (profile normalization etc.)
 */
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'apps/extension/src/autofill');
const out = path.join(root, 'dist/autofill');

Promise.all([
  esbuild.build({
    entryPoints: [path.join(src, 'browser-entry.ts')],
    outfile: path.join(out, 'autofill.iife.js'),
    bundle: true,
    format: 'iife',
    target: 'chrome110',
  }),
  esbuild.build({
    entryPoints: [path.join(src, 'index.ts')],
    outfile: path.join(out, 'autofill.cjs'),
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
  }),
])
  .then(() => console.log(`[build-autofill] wrote ${path.relative(root, out)}/autofill.{iife.js,cjs}`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
