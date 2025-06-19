import { type JsonSchemaObject, type ParserContext, type ParseResult } from '../types'
import { parseSchema } from './parseSchema'

export function parseArray(schema: JsonSchemaObject, context: ParserContext): ParseResult {
  const imports = new Set(['array'])
  const constraints: string[] = []
  
  // Parse items schema
  let itemsSchema = 'v.any()'
  let itemsImports = new Set<string>()
  let itemsType = 'any'
  
  if (schema.items) {
    if (Array.isArray(schema.items)) {
      // Tuple array - use first item as base type for now
      // Full tuple support would require more complex logic
      if (schema.items.length > 0 && schema.items[0]) {
        const firstItemResult = parseSchema(schema.items[0], { 
          ...context, 
          depth: context.depth + 1 
        })
        itemsSchema = firstItemResult.schema
        itemsImports = firstItemResult.imports
        itemsType = firstItemResult.types || 'any'
      }
    } else {
      // Single items schema
      const itemsResult = parseSchema(schema.items, { 
        ...context, 
        depth: context.depth + 1 
      })
      itemsSchema = itemsResult.schema
      itemsImports = itemsResult.imports
      itemsType = itemsResult.types || 'any'
    }
  } else {
    itemsImports.add('any')
  }
  
  // Add length constraints
  if (typeof schema.minItems === 'number') {
    constraints.push(`v.minLength(${schema.minItems})`)
    imports.add('minLength')
  }
  
  if (typeof schema.maxItems === 'number') {
    constraints.push(`v.maxLength(${schema.maxItems})`)
    imports.add('maxLength')
  }
  
  // Add unique items constraint
  if (schema.uniqueItems === true) {
    constraints.push('v.custom((input) => Array.isArray(input) && new Set(input).size === input.length, "Items must be unique")')
    imports.add('custom')
  }
  
  // Combine all imports
  const allImports = new Set([...imports, ...itemsImports])
  
  // Build the schema string
  const arrayBase = `v.array(${itemsSchema})`
  const schemaStr = constraints.length > 0 
    ? `v.pipe(${arrayBase}, ${constraints.join(', ')})`
    : arrayBase
  
  // Add pipe import if needed
  if (constraints.length > 0) {
    allImports.add('pipe')
  }
  
  return {
    schema: schemaStr,
    imports: allImports,
    types: `${itemsType}[]`
  }
}