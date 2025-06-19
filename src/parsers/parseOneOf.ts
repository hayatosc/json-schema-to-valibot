import { type JsonSchemaObject, type ParserContext, type ParseResult } from '../types'
import { parseSchema } from './parseSchema'

export function parseOneOf(schema: JsonSchemaObject, context: ParserContext): ParseResult {
  if (!schema.oneOf || schema.oneOf.length === 0) {
    return { schema: 'v.any()', imports: new Set(['any']) }
  }
  
  if (schema.oneOf.length === 1) {
    // Single schema - just parse it directly
    const firstSchema = schema.oneOf[0]
    if (firstSchema == null) throw new Error('Invalid schema in oneOf')
    return parseSchema(firstSchema, { ...context, depth: context.depth + 1 })
  }
  
  // Multiple schemas - create variant (discriminated union)
  // For simplicity, we'll use union like anyOf
  // A full implementation might try to detect discriminator fields
  const results = schema.oneOf.map(subSchema => {
    if (subSchema == null) throw new Error('Invalid schema in oneOf')
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
  
  // Filter out never() schemas for oneOf  
  const nonNeverSchemas = schemas.filter(schema => schema !== 'v.never()')
  
  if (nonNeverSchemas.length === 0) {
    // All schemas were never, result is never
    allImports.add('never')
    return {
      schema: 'v.never()',
      imports: allImports,
      types: 'never'
    }
  }
  
  if (nonNeverSchemas.length === 1) {
    // Only one non-never schema, return it directly
    const nonNeverResults = results.filter(r => r.schema !== 'v.never()')
    const result = nonNeverResults[0]
    if (!result) {
      return { schema: 'v.never()', imports: new Set(['never']), types: 'never' }
    }
    return {
      schema: result.schema,
      imports: allImports,
      types: result.types
    }
  }
  
  const nonNeverTypes = types.filter((_, i) => results[i]?.schema !== 'v.never()')
  return {
    schema: `v.union([${nonNeverSchemas.join(', ')}])`,
    imports: allImports,
    types: nonNeverTypes.length > 0 ? nonNeverTypes.join(' | ') : undefined
  }
}