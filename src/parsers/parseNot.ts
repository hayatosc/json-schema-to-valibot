import { type JsonSchema, type ParserContext, type ParseResult } from '../types'
import { parseSchema } from './parseSchema'

export function parseNot(schema: JsonSchema, context: ParserContext): ParseResult {
  if (!schema.not) {
    return { schema: 'v.any()', imports: new Set(['any']) }
  }
  
  // Parse the negated schema
  const notResult = parseSchema(schema.not, { ...context, depth: context.depth + 1 })
  const allImports = new Set(['custom', ...notResult.imports])
  
  // Create a custom validation that negates the schema
  const customValidation = `v.custom((input) => {
    try {
      v.parse(${notResult.schema}, input);
      return false; // If parsing succeeds, validation fails
    } catch {
      return true; // If parsing fails, validation succeeds
    }
  }, "Value must not match the specified schema")`
  
  return {
    schema: customValidation,
    imports: allImports,
    types: 'unknown' // Type cannot be determined for negation
  }
}