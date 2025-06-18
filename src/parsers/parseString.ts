import { type JsonSchema, type ParserContext, type ParseResult } from '../types'

export function parseString(schema: JsonSchema, _context: ParserContext): ParseResult {
  const imports = new Set(['string'])
  const constraints: string[] = []
  
  // Add length constraints
  if (typeof schema.minLength === 'number') {
    constraints.push(`v.minLength(${schema.minLength})`)
    imports.add('minLength')
  }
  
  if (typeof schema.maxLength === 'number') {
    constraints.push(`v.maxLength(${schema.maxLength})`)
    imports.add('maxLength')
  }
  
  // Add pattern constraint
  if (schema.pattern) {
    constraints.push(`v.regex(/${schema.pattern}/)`)
    imports.add('regex')
  }
  
  // Add format constraints
  if (schema.format) {
    switch (schema.format) {
      case 'email':
        constraints.push('v.email()')
        imports.add('email')
        break
      case 'uri':
      case 'url':
        constraints.push('v.url()')
        imports.add('url')
        break
      case 'uuid':
        constraints.push('v.uuid()')
        imports.add('uuid')
        break
      case 'date':
        constraints.push('v.isoDate()')
        imports.add('isoDate')
        break
      case 'date-time':
        constraints.push('v.isoDateTime()')
        imports.add('isoDateTime')
        break
      case 'time':
        constraints.push('v.isoTime()')
        imports.add('isoTime')
        break
      case 'ipv4':
        constraints.push('v.ipv4()')
        imports.add('ipv4')
        break
      case 'ipv6':
        constraints.push('v.ipv6()')
        imports.add('ipv6')
        break
      default:
        // Unknown format - skip
        break
    }
  }
  
  // Build the schema string
  const schemaStr = constraints.length > 0 
    ? `v.pipe(v.string(), ${constraints.join(', ')})`
    : 'v.string()'
  
  if (constraints.length > 0) {
    imports.add('pipe')
  }
  
  return {
    schema: schemaStr,
    imports,
    types: 'string'
  }
}