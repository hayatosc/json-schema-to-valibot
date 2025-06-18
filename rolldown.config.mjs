import { defineConfig } from 'rolldown'

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        exports: 'named'
      },
      {
        file: 'dist/index.mjs',
        format: 'esm'
      }
    ],
    external: ['valibot', 'citty']
  },
  {
    input: 'src/cli.ts',
    output: {
      file: 'dist/cli.js',
      format: 'cjs'
    },
    external: ['valibot', 'citty']
  }
])