import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

const commonOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
};

const extensionConfig = {
  ...commonOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  target: 'node18',
};

const webviewConfig = {
  ...commonOptions,
  entryPoints: ['src/webview/main.tsx'],
  outfile: 'dist/webview.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
};

if (isWatch) {
  const [extensionCtx, webviewCtx] = await Promise.all([
    esbuild.context(extensionConfig),
    esbuild.context(webviewConfig),
  ]);

  await Promise.all([
    extensionCtx.watch(),
    webviewCtx.watch(),
  ]);

  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(extensionConfig),
    esbuild.build(webviewConfig),
  ]);

  console.log('Build complete.');
}
