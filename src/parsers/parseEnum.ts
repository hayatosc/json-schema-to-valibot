import { type JsonSchema, type ParserContext, type ParseResult } from '../types'

export function parseEnum(schema: JsonSchema, _context: ParserContext): ParseResult {
  if (!schema.enum || schema.enum.length === 0) {
    return { schema: 'v.any()', imports: new Set(['any']) }
  }
  
  if (schema.enum.length === 1) {
    // Single enum value - use literal
    const value = schema.enum[0]
    return {
      schema: `v.literal(${JSON.stringify(value)})`,
      imports: new Set(['literal']),
      types: typeof value === 'string' ? `"${value}"` : JSON.stringify(value)
    }
  }
  
  // Multiple enum values - use picklist
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