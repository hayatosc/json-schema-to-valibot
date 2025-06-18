import { type JsonSchema, type ConversionOptions, type ParserContext } from './types'
import { parseSchema } from './parsers/parseSchema'

export function jsonSchemaToValibot(
  schema: JsonSchema,
  options: ConversionOptions = {}
): string {
  const {
    name = 'schema',
    module = 'esm',
    withTypes = false,
    withJsDoc = false,
    maxDepth = 10
  } = options

  const context: ParserContext = {
    refs: new Map(),
    depth: 0,
    maxDepth,
    currentPath: []
  }

  const result = parseSchema(schema, context)
  
  let output = ''
  
  // Add imports
  if (module !== 'none') {
    const importStatement = module === 'esm' 
      ? `import * as v from 'valibot'`
      : `const v = require('valibot')`
    output += `${importStatement}\n\n`
  }
  
  // Add JSDoc if requested
  if (withJsDoc && schema.description) {
    output += `/**\n * ${schema.description}\n */\n`
  }
  
  // Add the schema definition
  const exportStatement = module === 'esm' ? 'export ' : ''
  output += `${exportStatement}const ${name} = ${result.schema}\n`
  
  // Add TypeScript type if requested
  if (withTypes && result.types) {
    output += `\n${exportStatement}type ${name}Type = ${result.types}\n`
  }
  
  // Add default export for CJS
  if (module === 'cjs') {
    output += `\nmodule.exports = { ${name}${withTypes ? `, ${name}Type` : ''} }\n`
  }
  
  return output
}