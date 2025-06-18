import { type JsonSchema, type ParserContext, type ParseResult } from '../types'
import { parseSchema } from './parseSchema'

export function parseAnyOf(schema: JsonSchema, context: ParserContext): ParseResult {
  if (!schema.anyOf || schema.anyOf.length === 0) {
    return { schema: 'v.any()', imports: new Set(['any']) }
  }
  
  if (schema.anyOf.length === 1) {
    // Single schema - just parse it directly
    const firstSchema = schema.anyOf[0]
    if (!firstSchema) throw new Error('Invalid schema in anyOf')
    return parseSchema(firstSchema, { ...context, depth: context.depth + 1 })
  }
  
  // Multiple schemas - create union
  const results = schema.anyOf.map(subSchema => {
    if (!subSchema) throw new Error('Invalid schema in anyOf')
    return parseSchema(subSchema, { ...context, depth: context.depth + 1 })
  })
  
  const schemas = results.map(r => r.schema)
  const allImports = new Set(['union'])
  const types: string[] = []
  
  // Collect all imports and types
  results.forEach(result => {
    result.imports.forEach(imp => allImports.add(imp))
    if (result.types) {
      types.push(result.types)
    }
  })
  
  return {
    schema: `v.union([${schemas.join(', ')}])`,
    imports: allImports,
    types: types.length > 0 ? types.join(' | ') : undefined
  }
}