import { type JsonSchema, type ParserContext, type ParseResult } from '../types'

export function parseNull(_schema: JsonSchema, _context: ParserContext): ParseResult {
  return {
    schema: 'v.null_()',
    imports: new Set(['null_']),
    types: 'null'
  }
}