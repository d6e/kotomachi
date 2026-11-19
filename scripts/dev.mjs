// Dev server: esbuild watches src/ and serves www/ at http://127.0.0.1:8000
// Set HOST=0.0.0.0 to open it to other devices on your network (e.g. to try it on a phone).
import * as esbuild from 'esbuild';
import { options } from './build.mjs';

const port = Number(process.env.PORT ?? 8000);
const host = process.env.HOST ?? '127.0.0.1';
const ctx = await esbuild.context({ ...options, minify: false });
await ctx.watch();
await ctx.serve({ servedir: 'www', port, host });
console.log(`ことまち dev server: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
