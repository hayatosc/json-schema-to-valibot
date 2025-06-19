import { type JsonSchemaObject, type ParserContext, type ParseResult } from '../types'

export function parseConst(schema: JsonSchemaObject, context: ParserContext): ParseResult {
  const value = schema.const
  
  // For primitive values, use literal which is more efficient
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return {
      schema: `v.literal(${JSON.stringify(value)})`,
      imports: new Set(['literal']),
      types: typeof value === 'string' ? `"${value}"` : JSON.stringify(value)
    }
  }
  
  // For arrays, use tuple validation
  if (Array.isArray(value)) {
    const itemSchemas: string[] = []
    const allImports = new Set(['tuple'])
    const itemTypes: string[] = []
    
    for (const item of value) {
      const itemResult = parseConst({ const: item }, context)
      itemSchemas.push(itemResult.schema)
      itemResult.imports.forEach(imp => allImports.add(imp))
      itemTypes.push(itemResult.types || 'any')
    }
    
    return {
      schema: `v.tuple([${itemSchemas.join(', ')}])`,
      imports: allImports,
      types: `[${itemTypes.join(', ')}]`
    }
  }
  
  // For objects, use object validation
  if (typeof value === 'object' && value !== null) {
    const properties: string[] = []
    const allImports = new Set(['object'])
    const propertyTypes: string[] = []
    
    for (const [key, propValue] of Object.entries(value)) {
      const propResult = parseConst({ const: propValue }, context)
      properties.push(`${JSON.stringify(key)}: ${propResult.schema}`)
      propResult.imports.forEach(imp => allImports.add(imp))
      
      const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
      propertyTypes.push(`${keyStr}: ${propResult.types || 'any'}`)
    }
    
    return {
      schema: `v.object({ ${properties.join(', ')} })`,
      imports: allImports,
      types: `{ ${propertyTypes.join(', ')} }`
    }
  }
  
  // Fallback for any other types
  return {
    schema: `v.literal(${JSON.stringify(value)})`,
    imports: new Set(['literal']),
    types: JSON.stringify(value)
  }
}