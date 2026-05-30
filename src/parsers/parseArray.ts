import { type JsonSchema, type JsonSchemaObject, type ParserContext, type ParseResult } from '../types'
import { parseSchema } from './parseSchema'

export function parseArray(schema: JsonSchemaObject, context: ParserContext): ParseResult {
  const allImports = new Set<string>()
  const parseSub = (sub: JsonSchema): ParseResult =>
    parseSchema(sub, { ...context, depth: context.depth + 1 })

  let baseSchema: string
  let baseType: string

  // Positional schemas: `prefixItems` (2020-12) or the legacy tuple form `items: [...]`.
  const prefix = schema.prefixItems ?? (Array.isArray(schema.items) ? schema.items : undefined)

  if (prefix) {
    const itemResults = prefix.map(parseSub)
    itemResults.forEach((r) => r.imports.forEach((imp) => allImports.add(imp)))
    const itemSchemas = itemResults.map((r) => r.schema)
    baseType = `[${itemResults.map((r) => r.types || 'any').join(', ')}]`

    // What is allowed after the positional items: `items` (2020-12) or
    // `additionalItems` (legacy tuple form).
    const rest = schema.prefixItems ? schema.items : schema.additionalItems

    if (rest === false) {
      // No items beyond the tuple positions are permitted (strict length).
      baseSchema = `v.strictTuple([${itemSchemas.join(', ')}])`
      allImports.add('strictTuple')
    } else if (rest && typeof rest === 'object' && !Array.isArray(rest)) {
      const restResult = parseSub(rest)
      restResult.imports.forEach((imp) => allImports.add(imp))
      baseSchema = `v.tupleWithRest([${itemSchemas.join(', ')}], ${restResult.schema})`
      allImports.add('tupleWithRest')
    } else {
      // Additional items are unconstrained (items true/undefined).
      baseSchema = `v.tupleWithRest([${itemSchemas.join(', ')}], v.any())`
      allImports.add('tupleWithRest')
      allImports.add('any')
    }
  } else if (schema.items === false) {
    // `items: false` forbids any element, so only the empty array is valid.
    baseSchema = 'v.strictTuple([])'
    baseType = 'never[]'
    allImports.add('strictTuple')
  } else {
    // Regular array form: a single schema applied to every element.
    let itemsSchema = 'v.any()'
    let itemsType = 'any'
    if (schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
      const itemsResult = parseSub(schema.items)
      itemsSchema = itemsResult.schema
      itemsResult.imports.forEach((imp) => allImports.add(imp))
      itemsType = itemsResult.types || 'any'
    } else {
      allImports.add('any')
    }
    allImports.add('array')
    baseSchema = `v.array(${itemsSchema})`
    baseType = `${itemsType}[]`
  }

  // Length and uniqueness constraints apply on top of any of the forms above.
  const constraints: string[] = []

  if (typeof schema.minItems === 'number') {
    constraints.push(`v.minLength(${schema.minItems})`)
    allImports.add('minLength')
  }

  if (typeof schema.maxItems === 'number') {
    constraints.push(`v.maxLength(${schema.maxItems})`)
    allImports.add('maxLength')
  }

  if (schema.uniqueItems === true) {
    constraints.push(
      'v.custom((input) => Array.isArray(input) && new Set(input).size === input.length, "Items must be unique")',
    )
    allImports.add('custom')
  }

  if (constraints.length > 0) {
    allImports.add('pipe')
    return {
      schema: `v.pipe(${baseSchema}, ${constraints.join(', ')})`,
      imports: allImports,
      types: baseType,
    }
  }

  return { schema: baseSchema, imports: allImports, types: baseType }
}
