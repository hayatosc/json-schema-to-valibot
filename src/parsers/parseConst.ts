import { type JsonSchema, type ParserContext, type ParseResult } from '../types'

export function parseConst(schema: JsonSchema, _context: ParserContext): ParseResult {
  const value = schema.const
  
  return {
    schema: `v.literal(${JSON.stringify(value)})`,
    imports: new Set(['literal']),
    types: typeof value === 'string' ? `"${value}"` : JSON.stringify(value)
  }
}