import { defineConfig } from 'tsdown';

export default [
  defineConfig({
    entry: 'src/index.ts',
    format: ['cjs', 'esm'],
    outDir: 'dist',
    external: ['valibot'],
    dts: true,
  }),
  defineConfig({
    entry: 'src/cli.ts',
    format: ['cjs'],
    outDir: 'dist',
    external: ['valibot', 'citty'],
    dts: true,
  }),
];
