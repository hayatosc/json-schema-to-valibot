import {
  type JsonSchema,
  type JsonSchemaObject,
  type JsonSchemaType,
  type ParserContext,
  type ParseResult,
} from '../types'
import { parseAllOf } from './parseAllOf'
import { parseAnyOf } from './parseAnyOf'
import { parseArray } from './parseArray'
import { parseBoolean } from './parseBoolean'
import { parseConst } from './parseConst'
import { parseEnum } from './parseEnum'
import { parseNot } from './parseNot'
import { parseNull } from './parseNull'
import { parseNumber } from './parseNumber'
import { parseObject } from './parseObject'
import { parseOneOf } from './parseOneOf'
import { parseString } from './parseString'

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

  // Handle composition schemas. Multiple composition keywords and any sibling
  // base constraints all apply at once, so combine them with v.intersect.
  if (schema.allOf || schema.anyOf || schema.oneOf || schema.not) {
    return parseComposition(schema, context)
  }

  // Handle const and enum
  if (schema.const !== undefined) return parseConst(schema, context)
  if (schema.enum) return parseEnum(schema, context)

  // Handle nullable
  if (schema.nullable === true) {
    const baseResult = parseSchemaType(schema, context)
    return {
      schema: `v.nullable(${baseResult.schema})`,
      imports: new Set([...baseResult.imports, 'nullable']),
      types: baseResult.types ? `${baseResult.types} | null` : undefined,
    }
  }

  return parseSchemaType(schema, context)
}

// Keywords that imply a specific instance type when `type` is omitted.
// JSON Schema applies these keywords only to instances of the matching type,
// so their presence is a reliable signal of the intended type.
const TYPE_KEYWORDS: [JsonSchemaType, string[]][] = [
  [
    'object',
    [
      'properties',
      'additionalProperties',
      'required',
      'patternProperties',
      'propertyNames',
      'minProperties',
      'maxProperties',
    ],
  ],
  ['array', ['items', 'prefixItems', 'additionalItems', 'minItems', 'maxItems', 'uniqueItems']],
  ['string', ['minLength', 'maxLength', 'pattern', 'format']],
  ['number', ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']],
]

function inferTypesFromKeywords(schema: JsonSchemaObject): JsonSchemaType[] {
  const inferred: JsonSchemaType[] = []
  for (const [type, keywords] of TYPE_KEYWORDS) {
    if (keywords.some((keyword) => keyword in schema)) {
      inferred.push(type)
    }
  }
  return inferred
}

function parseComposition(schema: JsonSchemaObject, context: ParserContext): ParseResult {
  const parts: ParseResult[] = []

  if (schema.allOf) parts.push(parseAllOf(schema, context))
  if (schema.anyOf) parts.push(parseAnyOf(schema, context))
  if (schema.oneOf) parts.push(parseOneOf(schema, context))
  if (schema.not) parts.push(parseNot(schema, context))

  // Sibling base constraints (e.g. `type`/`properties`) also have to hold.
  if (schema.type !== undefined || inferTypesFromKeywords(schema).length > 0) {
    parts.push(parseSchemaType(schema, context))
  }

  const [firstPart] = parts
  if (parts.length === 1 && firstPart) return firstPart

  const imports = new Set<string>(['intersect'])
  const types: string[] = []
  for (const part of parts) {
    part.imports.forEach((imp) => imports.add(imp))
    if (part.types) types.push(part.types)
  }

  return {
    schema: `v.intersect([${parts.map((part) => part.schema).join(', ')}])`,
    imports,
    types: types.length > 0 ? types.join(' & ') : undefined,
  }
}

function parseSchemaType(schema: JsonSchemaObject, context: ParserContext): ParseResult {
  let type = schema.type

  // When `type` is omitted, infer it from type-specific keywords so the
  // relevant constraints are still emitted instead of falling back to v.any().
  if (type === undefined) {
    const inferred = inferTypesFromKeywords(schema)
    if (inferred.length === 1) {
      type = inferred[0]
    } else if (inferred.length > 1) {
      type = inferred
    }
  }

  if (Array.isArray(type)) {
    // Multiple types - create a union
    const results = type.map((t) => parseSchema({ ...schema, type: t }, context))
    const schemas = results.map((r) => r.schema)
    const allImports = new Set<string>()
    results.forEach((r) => r.imports.forEach((imp) => allImports.add(imp)))
    allImports.add('union')

    return {
      schema: `v.union([${schemas.join(', ')}])`,
      imports: allImports,
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
    case undefined:
    default:
      // No type specified or unknown type
      return { schema: 'v.any()', imports: new Set(['any']) }
  }
}

function handleRef(ref: string, context: ParserContext): ParseResult {
  const refData = context.refs.get(ref)

  if (refData) {
    // If the definition is currently being processed, this indicates a circular dependency.
    if (refData.isProcessing) {
      console.warn(`Circular dependency detected for ${ref}. Using v.lazy() for proper recursion.`)
      // Mark as recursive for proper type annotation
      refData.isRecursive = true
      // Use v.lazy() for proper recursive schema support
      // For recursive schemas, reference the schema (not the type)
      const schemaReference = refData.isRecursive
        ? `${refData.schemaName}Schema`
        : refData.schemaName
      return { schema: `v.lazy(() => ${schemaReference})`, imports: new Set(['lazy']) }
    }
    // If the code for this ref has already been generated (e.g. processing nested refs within a definition),
    // and we encounter it again, we should use its schemaName.
    // However, the primary generation of definition code happens in jsonSchemaToValibot.ts.
    // Here, we just need to return the schemaName so it's used in the referencing schema.
    // For recursive schemas, always use the Schema suffix for consistency
    const schemaReference = refData.isRecursive ? `${refData.schemaName}Schema` : refData.schemaName
    return { schema: schemaReference, imports: new Set() } // Imports for the definition itself are handled when it's declared.
  }

  // Fallback for unresolved refs (e.g., external refs or typos)
  console.warn(`$ref not found: ${ref}. Using v.any() as fallback.`)
  return { schema: 'v.any()', imports: new Set(['v']) } // 'v' for v.any()
}
