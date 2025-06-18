import { defineConfig } from 'rolldown'

export default defineConfig([
  // Library CJS
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist',
      format: 'cjs',
      exports: 'named',
      entryFileNames: 'index.js'
    },
    external: ['valibot', 'citty']
  },
  // Library ESM
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: 'index.mjs'
    },
    external: ['valibot', 'citty']
  },
  // CLI
  {
    input: 'src/cli.ts',
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: 'cli.cjs'
    },
    external: ['valibot', 'citty']
  }
])