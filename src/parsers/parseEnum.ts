import { type JsonSchema, type ParserContext, type ParseResult } from '../types'
import { parseConst } from './parseConst'

export function parseEnum(schema: JsonSchema, context: ParserContext): ParseResult {
  if (!schema.enum || schema.enum.length === 0) {
    return { schema: 'v.any()', imports: new Set(['any']) }
  }
  
  // Check if all enum values are primitives
  const hasComplexValues = schema.enum.some(value => 
    value !== null && typeof value === 'object'
  )
  
  if (schema.enum.length === 1) {
    // Single enum value - delegate to parseConst
    return parseConst({ const: schema.enum[0] }, context)
  }
  
  if (hasComplexValues) {
    // Multiple enum values with at least one complex type - use union of individual validators
    const validators: string[] = []
    const imports = new Set<string>(['union'])
    const types: string[] = []
    
    for (const value of schema.enum) {
      const valueResult = parseConst({ const: value }, context)
      validators.push(valueResult.schema)
      valueResult.imports.forEach(imp => imports.add(imp))
      types.push(valueResult.types || 'any')
    }
    
    return {
      schema: `v.union([${validators.join(', ')}])`,
      imports,
      types: types.join(' | ')
    }
  } else {
    // Multiple primitive enum values - use picklist
    const values = schema.enum.map(v => JSON.stringify(v))
    const types = schema.enum.map(v => 
      typeof v === 'string' ? `"${v}"` : JSON.stringify(v)
    ).join(' | ')
    
    return {
      schema: `v.picklist([${values.join(', ')}])`,
      imports: new Set(['picklist']),
      types
    }
  }
}