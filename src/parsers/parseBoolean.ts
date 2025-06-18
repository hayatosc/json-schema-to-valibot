import { type JsonSchema, type ParserContext, type ParseResult } from '../types'

export function parseBoolean(_schema: JsonSchema, _context: ParserContext): ParseResult {
  return {
    schema: 'v.boolean()',
    imports: new Set(['boolean']),
    types: 'boolean'
  }
}