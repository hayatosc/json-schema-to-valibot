import { type JsonSchemaObject, type ParserContext, type ParseResult } from '../types'
import { parseSchema } from './parseSchema'

export function parseAllOf(schema: JsonSchemaObject, context: ParserContext): ParseResult {
  if (!schema.allOf || schema.allOf.length === 0) {
    return { schema: 'v.any()', imports: new Set(['any']) }
  }
  
  if (schema.allOf.length === 1) {
    // Single schema - just parse it directly
    const firstSchema = schema.allOf[0]
    if (firstSchema == null) throw new Error('Invalid schema in allOf')
    return parseSchema(firstSchema, { ...context, depth: context.depth + 1 })
  }
  
  // For allOf, we need to intersect the schemas
  // In Valibot, this is typically done with v.intersect for objects
  // For other types, we'll try to merge constraints where possible
  
  const results = schema.allOf.map(subSchema => {
    if (subSchema == null) throw new Error('Invalid schema in allOf')
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
    typeof subSchema === 'object' && subSchema !== null && 
    (subSchema.type === 'object' || subSchema.properties)
  )
  
  if (allObjects) {
    allImports.add('intersect')
    return {
      schema: `v.intersect([${results.map(r => r.schema).join(', ')}])`,
      imports: allImports,
      types: types.length > 0 ? types.join(' & ') : undefined
    }
  }
  
  // For non-objects, check if any schema is never (false)
  // If any schema in allOf is never, the result is never
  const hasNeverSchema = results.some(result => result.schema === 'v.never()')
  if (hasNeverSchema) {
    allImports.add('never')
    return {
      schema: 'v.never()',
      imports: allImports,
      types: 'never'
    }
  }
  
  // Filter out any() schemas and use the most restrictive one
  const nonAnyResults = results.filter(result => result.schema !== 'v.any()')
  if (nonAnyResults.length === 0) {
    // All schemas were any(), result is any()
    allImports.add('any')
    return {
      schema: 'v.any()',
      imports: allImports,
      types: types.length > 0 ? types.join(' & ') : undefined
    }
  }
  
  // For now, use the first non-any schema (this is a simplification)
  const firstResult = nonAnyResults[0]
  if (!firstResult) {
    return { schema: 'v.any()', imports: new Set(['any']), types: undefined }
  }
  
  return {
    schema: firstResult.schema,
    imports: allImports,
    types: types.length > 0 ? types.join(' & ') : firstResult.types
  }
}