#!/usr/bin/env node

import { defineCommand, runMain } from 'citty'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { jsonSchemaToValibot } from './jsonSchemaToValibot'
import type { JsonSchema, ConversionOptions } from './types'

const main = defineCommand({
  meta: {
    name: 'json-schema-to-valibot',
    version: '0.1.0',
    description: 'Convert JSON Schema definitions to Valibot schema definitions'
  },
  args: {
    input: {
      type: 'string',
      description: 'Input JSON Schema file path or JSON string',
      alias: 'i'
    },
    output: {
      type: 'string',
      description: 'Output file path (defaults to stdout)',
      alias: 'o'
    },
    name: {
      type: 'string',
      description: 'Schema name in output',
      alias: 'n',
      default: 'schema'
    },
    module: {
      type: 'string',
      description: 'Module system (esm, cjs, none)',
      alias: 'm',
      default: 'esm'
    },
    types: {
      type: 'boolean',
      description: 'Generate TypeScript type exports',
      alias: 't',
      default: false
    },
    jsdoc: {
      type: 'boolean',
      description: 'Include JSDoc comments',
      alias: 'd',
      default: false
    },
    depth: {
      type: 'string',
      description: 'Maximum recursion depth',
      default: '10'
    },
    'export-definitions': {
      type: 'boolean',
      description: 'Export schema definitions',
      default: true
    }
  },
  async run({ args }) {
    try {
      let schemaInput: string
      
      // Read input
      if (args.input) {
        if (args.input.startsWith('{') || args.input.startsWith('[')) {
          // Direct JSON string
          schemaInput = args.input
        } else {
          // File path
          const inputPath = resolve(args.input)
          schemaInput = await readFile(inputPath, 'utf-8')
        }
      } else {
        // Read from stdin
        schemaInput = await readStdin()
      }
      
      // Parse JSON Schema
      let jsonSchema: JsonSchema
      try {
        jsonSchema = JSON.parse(schemaInput)
      } catch (error) {
        console.error('Error parsing JSON Schema:', error)
        process.exit(1)
      }
      
      // Validate module option
      if (!['esm', 'cjs', 'none'].includes(args.module)) {
        console.error('Module must be one of: esm, cjs, none')
        process.exit(1)
      }
      
      // Build conversion options
      const options: ConversionOptions = {
        name: args.name,
        module: args.module as 'esm' | 'cjs' | 'none',
        withTypes: args.types,
        withJsDoc: args.jsdoc,
        maxDepth: parseInt(args.depth, 10),
        exportDefinitions: args['export-definitions']
      }
      
      
      // Convert schema
      const valibotCode = jsonSchemaToValibot(jsonSchema, options)
      
      // Output result
      if (args.output) {
        const outputPath = resolve(args.output)
        await writeFile(outputPath, valibotCode, 'utf-8')
        console.error(`✓ Schema written to ${outputPath}`)
      } else {
        console.log(valibotCode)
      }
      
    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    }
  }
})

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    
    process.stdin.setEncoding('utf8')
    
    process.stdin.on('readable', () => {
      let chunk
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk
      }
    })
    
    process.stdin.on('end', () => {
      resolve(data.trim())
    })
    
    process.stdin.on('error', reject)
  })
}

runMain(main)