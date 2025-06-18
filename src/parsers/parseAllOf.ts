import { type JsonSchema, type ParserContext, type ParseResult } from '../types'
import { parseSchema } from './parseSchema'

export function parseAllOf(schema: JsonSchema, context: ParserContext): ParseResult {
  if (!schema.allOf || schema.allOf.length === 0) {
    return { schema: 'v.any()', imports: new Set(['any']) }
  }
  
  if (schema.allOf.length === 1) {
    // Single schema - just parse it directly
    const firstSchema = schema.allOf[0]
    if (!firstSchema) throw new Error('Invalid schema in allOf')
    return parseSchema(firstSchema, { ...context, depth: context.depth + 1 })
  }
  
  // For allOf, we need to intersect the schemas
  // In Valibot, this is typically done with v.intersect for objects
  // For other types, we'll try to merge constraints where possible
  
  const results = schema.allOf.map(subSchema => {
    if (!subSchema) throw new Error('Invalid schema in allOf')
    return parseSchema(subSchema, { ...context, depth: context.depth + 1 })
  })
  
  const allImports = new Set<string>()
  const types: string[] = []
  
  // Collect all imports and types
  results.forEach(result => {
    result.imports.forEach(imp => allImports.add(imp))
    if (result.types) {
      types.push(result.types)
    }
  })
  
  // Check if all schemas are objects - then we can use intersect
  const allObjects = schema.allOf.every(subSchema => 
    subSchema.type === 'object' || subSchema.properties
  )
  
  if (allObjects) {
    allImports.add('intersect')
    return {
      schema: `v.intersect([${results.map(r => r.schema).join(', ')}])`,
      imports: allImports,
      types: types.length > 0 ? types.join(' & ') : undefined
    }
  }
  
  // For non-objects, fall back to the first schema with additional constraints
  // This is a simplification - a full implementation would merge constraints
  const firstResult = results[0]
  if (!firstResult) {
    return { schema: 'v.any()', imports: new Set(['any']), types: undefined }
  }
  
  return {
    schema: firstResult.schema,
    imports: allImports,
    types: types.length > 0 ? types.join(' & ') : firstResult.types
  }
}