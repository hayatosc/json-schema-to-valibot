import { type JsonSchemaObject, type ParserContext, type ParseResult } from '../types'

export function parseBoolean(_schema: JsonSchemaObject, _context: ParserContext): ParseResult {
  return {
    schema: 'v.boolean()',
    imports: new Set(['boolean']),
    types: 'boolean'
  }
}