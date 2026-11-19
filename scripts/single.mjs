// Builds the whole game into one self-contained HTML file (CSS and JS inlined, no
// source map), for hosting as a single page. Default output: dist/kotomachi.html.
// Pass a path to write somewhere else: node scripts/single.mjs /tmp/kotomachi.html
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { options } from './build.mjs';

const out = path.resolve(process.argv[2] ?? 'dist/kotomachi.html');
const result = await esbuild.build({ ...options, outdir: undefined, outfile: 'single.js', write: false, sourcemap: false, minify: true, logLevel: 'warning' });
const js = result.outputFiles.find((f) => f.path.endsWith('.js'));
if (!js) throw new Error('esbuild produced no JavaScript');
const css = fs.readFileSync('www/style.css', 'utf8');
const html = fs.readFileSync('www/index.html', 'utf8');

// Inline scripts must not contain a closing script tag.
const script = js.text.replace(/<\/script/gi, '<\\/script').replace(/\/\/# sourceMappingURL=.*$/m, '');
const page = html
  .replace(/<link rel="stylesheet" href="style.css" \/>/, () => `<style>\n${css}</style>`)
  .replace(/<script type="module" src="build\/main.js"><\/script>/, () => `<script type="module">\n${script}</script>`);
if (page.includes('href="style.css"') || page.includes('src="build/main.js"')) throw new Error('index.html changed: update scripts/single.mjs');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`wrote ${path.relative(process.cwd(), out) || out} (${Math.round(page.length / 1024)} KB)`);
