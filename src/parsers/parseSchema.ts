import { type JsonSchema, type JsonSchemaObject, type ParserContext, type ParseResult } from '../types'
import { parseString } from './parseString'
import { parseNumber } from './parseNumber'
import { parseBoolean } from './parseBoolean'
import { parseArray } from './parseArray'
import { parseObject } from './parseObject'
import { parseNull } from './parseNull'
import { parseAnyOf } from './parseAnyOf'
import { parseAllOf } from './parseAllOf'
import { parseOneOf } from './parseOneOf'
import { parseNot } from './parseNot'
import { parseConst } from './parseConst'
import { parseEnum } from './parseEnum'

export function parseSchema(schema: JsonSchema, context: ParserContext): ParseResult {
  // Prevent infinite recursion
  if (context.depth > context.maxDepth) {
    return { schema: 'v.any()', imports: new Set(['any']) }
  }

  // Handle boolean schemas
  if (typeof schema === 'boolean') {
    if (schema === true) {
      return { schema: 'v.any()', imports: new Set(['any']) }
    } else {
      return { schema: 'v.never()', imports: new Set(['never']) }
    }
  }

  // Handle $ref
  if (schema.$ref) {
    return handleRef(schema.$ref, context)
  }

  // Handle composition schemas first
  if (schema.allOf) return parseAllOf(schema, context)
  if (schema.anyOf) return parseAnyOf(schema, context)
  if (schema.oneOf) return parseOneOf(schema, context)
  if (schema.not) return parseNot(schema, context)

  // Handle const and enum
  if (schema.const !== undefined) return parseConst(schema, context)
  if (schema.enum) return parseEnum(schema, context)

  // Handle nullable
  if (schema.nullable === true) {
    const baseResult = parseSchemaType(schema, context)
    return {
      schema: `v.nullable(${baseResult.schema})`,
      imports: new Set([...baseResult.imports, 'nullable']),
      types: baseResult.types ? `${baseResult.types} | null` : undefined
    }
  }

  return parseSchemaType(schema, context)
}

function parseSchemaType(schema: JsonSchemaObject, context: ParserContext): ParseResult {
  const type = schema.type

  if (Array.isArray(type)) {
    // Multiple types - create a union
    const results = type.map(t => parseSchema({ ...schema, type: t }, context))
    const schemas = results.map(r => r.schema)
    const allImports = new Set<string>()
    results.forEach(r => r.imports.forEach(imp => allImports.add(imp)))
    allImports.add('union')

    return {
      schema: `v.union([${schemas.join(', ')}])`,
      imports: allImports
    }
  }

  switch (type) {
    case 'string':
      return parseString(schema, context)
    case 'number':
    case 'integer':
      return parseNumber(schema, context)
    case 'boolean':
      return parseBoolean(schema, context)
    case 'array':
      return parseArray(schema, context)
    case 'object':
      return parseObject(schema, context)
    case 'null':
      return parseNull(schema, context)
    default:
      // No type specified or unknown type
      return { schema: 'v.any()', imports: new Set(['any']) }
  }
}

function handleRef(ref: string, _context: ParserContext): ParseResult {
  // Simple $ref handling - in a full implementation, this would resolve references
  // For now, just return any() as a placeholder
  console.warn(`$ref resolution not yet implemented: ${ref}`)
  return { schema: 'v.any()', imports: new Set(['any']) }
}