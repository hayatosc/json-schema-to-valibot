import { type JsonSchema, type ParserContext, type ParseResult } from '../types'
import { parseSchema } from './parseSchema'

export function parseOneOf(schema: JsonSchema, context: ParserContext): ParseResult {
  if (!schema.oneOf || schema.oneOf.length === 0) {
    return { schema: 'v.any()', imports: new Set(['any']) }
  }
  
  if (schema.oneOf.length === 1) {
    // Single schema - just parse it directly
    const firstSchema = schema.oneOf[0]
    if (!firstSchema) throw new Error('Invalid schema in oneOf')
    return parseSchema(firstSchema, { ...context, depth: context.depth + 1 })
  }
  
  // Multiple schemas - create variant (discriminated union)
  // For simplicity, we'll use union like anyOf
  // A full implementation might try to detect discriminator fields
  const results = schema.oneOf.map(subSchema => {
    if (!subSchema) throw new Error('Invalid schema in oneOf')
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