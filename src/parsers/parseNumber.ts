import { type JsonSchemaObject, type ParserContext, type ParseResult } from '../types'

export function parseNumber(schema: JsonSchemaObject, _context: ParserContext): ParseResult {
  const isInteger = schema.type === 'integer'
  const imports = new Set([isInteger ? 'integer' : 'number'])
  const constraints: string[] = []

  // Add minimum constraint
  if (typeof schema.minimum === 'number') {
    constraints.push(`v.minValue(${schema.minimum})`)
    imports.add('minValue')
  }

  // Add maximum constraint
  if (typeof schema.maximum === 'number') {
    constraints.push(`v.maxValue(${schema.maximum})`)
    imports.add('maxValue')
  }

  // Add exclusive minimum constraint (gtValue enforces strict greater-than)
  if (typeof schema.exclusiveMinimum === 'number') {
    constraints.push(`v.gtValue(${schema.exclusiveMinimum})`)
    imports.add('gtValue')
  } else if (schema.exclusiveMinimum === true && typeof schema.minimum === 'number') {
    constraints.push(`v.gtValue(${schema.minimum})`)
    imports.add('gtValue')
  }

  // Add exclusive maximum constraint (ltValue enforces strict less-than)
  if (typeof schema.exclusiveMaximum === 'number') {
    constraints.push(`v.ltValue(${schema.exclusiveMaximum})`)
    imports.add('ltValue')
  } else if (schema.exclusiveMaximum === true && typeof schema.maximum === 'number') {
    constraints.push(`v.ltValue(${schema.maximum})`)
    imports.add('ltValue')
  }

  // Add multiple of constraint
  if (typeof schema.multipleOf === 'number') {
    constraints.push(`v.multipleOf(${schema.multipleOf})`)
    imports.add('multipleOf')
  }

  // Build the schema string - use number() for both number and integer
  const baseSchema = 'v.number()'
  const schemaStr =
    constraints.length > 0 ? `v.pipe(${baseSchema}, ${constraints.join(', ')})` : baseSchema

  if (constraints.length > 0) {
    imports.add('pipe')
  }

  // Add integer validation if needed
  if (isInteger && constraints.length === 0) {
    imports.delete('integer')
    imports.add('number')
    imports.add('pipe')
    imports.add('integer')
    return {
      schema: `v.pipe(v.number(), v.integer())`,
      imports,
      types: 'number',
    }
  } else if (isInteger) {
    imports.delete('integer')
    imports.add('integer')
    constraints.unshift('v.integer()')
  }

  return {
    schema: schemaStr,
    imports,
    types: 'number',
  }
}
