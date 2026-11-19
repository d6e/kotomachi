// Production build: bundles src/main.ts into www/build/main.js. Pass --watch to rebuild on change.
import * as esbuild from 'esbuild';

export const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outdir: 'www/build',
  sourcemap: true,
  minify: !process.argv.includes('--dev'),
  logLevel: 'info',
};

if (import.meta.url === `file://${process.argv[1]}`) {
  await esbuild.build(options);
}
