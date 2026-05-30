import { unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import * as v from 'valibot'
import { describe, expect, it } from 'vitest'

import { jsonSchemaToValibot } from '../src/jsonSchemaToValibot'
import type { JsonSchema } from '../src/types'

// Compile a JSON Schema to a runnable Valibot schema so tests can assert the
// actual validation behavior (not just the generated source string). The
// generated module is written next to the package so `valibot` resolves, then
// imported and removed (same approach as script/test-suite-runner.ts).
async function compile(schema: JsonSchema): Promise<v.GenericSchema> {
  const code = jsonSchemaToValibot(schema, { exportDefinitions: false })
  const file = path.join(
    process.cwd(),
    `.compile-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`,
  )
  writeFileSync(file, code)
  try {
    const mod: { schema: v.GenericSchema } = await import(pathToFileURL(file).href)
    return mod.schema
  } finally {
    unlinkSync(file)
  }
}

async function accepts(schema: JsonSchema, data: unknown): Promise<boolean> {
  return v.safeParse(await compile(schema), data).success
}

describe('jsonSchemaToValibot', () => {
  it('should convert basic string schema', () => {
    const schema = { type: 'string' as const }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain("import * as v from 'valibot'")
    expect(result).toContain('const schema = v.string()')
  })

  it('should convert string with constraints', () => {
    const schema = {
      type: 'string' as const,
      minLength: 5,
      maxLength: 100,
      pattern: '^[a-z]+$',
    }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain(
      'v.pipe(v.string(), v.minLength(5), v.maxLength(100), v.regex(/^[a-z]+$/u))',
    )
  })

  it('should convert string format to corresponding valibot action', () => {
    const cases: Array<[string, string]> = [
      ['email', 'v.email()'],
      ['uuid', 'v.uuid()'],
      ['date', 'v.isoDate()'],
      ['date-time', 'v.isoTimestamp()'],
      ['time', 'v.isoTime()'],
      ['ipv4', 'v.ipv4()'],
      ['ipv6', 'v.ipv6()'],
    ]

    for (const [format, action] of cases) {
      const result = jsonSchemaToValibot({ type: 'string' as const, format })
      expect(result).toContain(`v.pipe(v.string(), ${action})`)
    }
  })

  it('should convert basic number schema', () => {
    const schema = { type: 'number' as const }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain('const schema = v.number()')
  })

  it('should convert integer with constraints', () => {
    const schema = {
      type: 'integer' as const,
      minimum: 0,
      maximum: 100,
    }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain('v.pipe(v.number(), v.minValue(0), v.maxValue(100))')
  })

  it('should convert boolean schema', () => {
    const schema = { type: 'boolean' as const }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain('const schema = v.boolean()')
  })

  it('should convert array schema', () => {
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const },
    }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain('v.array(v.string())')
  })

  it('should convert object schema', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const },
        age: { type: 'number' as const },
      },
      required: ['name'],
    }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain('v.object({')
    expect(result).toContain('"name": v.string()')
    expect(result).toContain('"age": v.optional(v.number())')
  })

  it('should convert enum schema', () => {
    const schema = {
      enum: ['red', 'green', 'blue'],
    }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain('v.picklist(["red", "green", "blue"])')
  })

  it('should convert const schema', () => {
    const schema = {
      const: 'hello',
    }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain('v.literal("hello")')
  })

  it('should convert anyOf schema', () => {
    const schema = {
      anyOf: [{ type: 'string' as const }, { type: 'number' as const }],
    }
    const result = jsonSchemaToValibot(schema)

    expect(result).toContain('v.union([v.string(), v.number()])')
  })

  it('should handle custom schema name', () => {
    const schema = { type: 'string' as const }
    const result = jsonSchemaToValibot(schema, { name: 'customSchema' })

    expect(result).toContain('const customSchema = v.string()')
  })

  it('should handle CommonJS module format', () => {
    const schema = { type: 'string' as const }
    const result = jsonSchemaToValibot(schema, { module: 'cjs' })

    expect(result).toContain("const v = require('valibot')")
    expect(result).toContain('module.exports = { schema }')
  })

  it('should handle no module format', () => {
    const schema = { type: 'string' as const }
    const result = jsonSchemaToValibot(schema, { module: 'none' })

    expect(result).not.toContain('import')
    expect(result).not.toContain('require')
    expect(result).toContain('const schema = v.string()')
  })

  // New tests for PR #5 features
  describe('$ref resolution', () => {
    it('should resolve local $ref to definitions', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          user: { $ref: '#/definitions/User' },
        },
        definitions: {
          User: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const },
              age: { type: 'number' as const },
            },
            required: ['name'],
          },
        },
      }
      const result = jsonSchemaToValibot(schema)

      // Should generate a constant for the User definition
      expect(result).toContain('export const User = v.object({')
      expect(result).toContain('"name": v.string()')
      expect(result).toContain('"age": v.optional(v.number())')

      // Should reference the User constant in the main schema
      expect(result).toContain('"user": v.optional(User)')

      // Should export the User definition by default
      expect(result).toContain('export const User = v.object({')
    })

    it('should resolve local $ref to $defs', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          profile: { $ref: '#/$defs/Profile' },
        },
        $defs: {
          Profile: {
            type: 'object' as const,
            properties: {
              bio: { type: 'string' as const },
            },
          },
        },
      }
      const result = jsonSchemaToValibot(schema)

      // Should generate a constant for the Profile definition
      expect(result).toContain('export const Profile = v.object({')
      expect(result).toContain('"bio": v.optional(v.string())')

      // Should reference the Profile constant
      expect(result).toContain('"profile": v.optional(Profile)')
    })

    it('should handle circular $ref dependencies', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          node: { $ref: '#/definitions/Node' },
        },
        definitions: {
          Node: {
            type: 'object' as const,
            properties: {
              value: { type: 'string' as const },
              child: { $ref: '#/definitions/Node' },
            },
          },
        },
      }
      const result = jsonSchemaToValibot(schema)

      // Should generate the Node definition with type annotation for recursion
      expect(result).toContain('export type Node = { value?: string; child?: Node };')
      expect(result).toContain('export const NodeSchema: v.GenericSchema<Node> = v.object({')
      expect(result).toContain('"value": v.optional(v.string())')

      // Should handle circular reference with v.lazy()
      expect(result).toContain('"child": v.optional(v.lazy(() => NodeSchema))')
    })

    it('should handle more complex recursive schemas (binary tree)', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          tree: { $ref: '#/definitions/BinaryTree' },
        },
        definitions: {
          BinaryTree: {
            type: 'object' as const,
            properties: {
              value: { type: 'number' as const },
              left: {
                anyOf: [{ $ref: '#/definitions/BinaryTree' }, { type: 'null' as const }],
              },
              right: {
                anyOf: [{ $ref: '#/definitions/BinaryTree' }, { type: 'null' as const }],
              },
            },
            required: ['value'],
          },
        },
      }
      const result = jsonSchemaToValibot(schema)

      // Should generate the BinaryTree definition with type annotation for recursion
      expect(result).toContain(
        'export type BinaryTree = { value: number; left?: BinaryTree | null; right?: BinaryTree | null };',
      )
      expect(result).toContain(
        'export const BinaryTreeSchema: v.GenericSchema<BinaryTree> = v.object({',
      )
      expect(result).toContain('"value": v.number()')

      // Should handle recursive references in left and right with v.lazy()
      expect(result).toContain('v.lazy(() => BinaryTreeSchema)')
    })

    it('should generate proper TypeScript types for recursive schemas', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          jsonValue: { $ref: '#/definitions/JsonValue' },
        },
        definitions: {
          JsonValue: {
            anyOf: [
              { type: 'string' as const },
              { type: 'number' as const },
              { type: 'boolean' as const },
              { type: 'null' as const },
              {
                type: 'object' as const,
                additionalProperties: { $ref: '#/definitions/JsonValue' },
              },
              {
                type: 'array' as const,
                items: { $ref: '#/definitions/JsonValue' },
              },
            ],
          },
        },
      }
      const result = jsonSchemaToValibot(schema)

      // Should generate recursive JSON value schema with type annotation
      expect(result).toContain(
        'export type JsonValue = string | number | boolean | null | Record<string, any> | JsonValue[];',
      )
      expect(result).toContain(
        'export const JsonValueSchema: v.GenericSchema<JsonValue> = v.union([',
      )
      expect(result).toContain('v.lazy(() => JsonValueSchema)')
      expect(result).toContain('v.string()')
      expect(result).toContain('v.number()')
      expect(result).toContain('v.boolean()')
      expect(result).toContain('v.null_()')
    })

    it('should not export definitions when exportDefinitions is false', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          user: { $ref: '#/definitions/User' },
        },
        definitions: {
          User: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const },
            },
          },
        },
      }
      const result = jsonSchemaToValibot(schema, { exportDefinitions: false })

      // Should not export the User definition
      expect(result).toContain('const User = v.object({')
      expect(result).not.toContain('export const User = v.object({')

      // Should still reference the User constant
      expect(result).toContain('"user": v.optional(User)')
    })

    it('should export definitions by default', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          profile: { $ref: '#/$defs/Profile' },
        },
        $defs: {
          Profile: {
            type: 'object' as const,
            properties: {
              bio: { type: 'string' as const },
            },
          },
        },
      }
      const result = jsonSchemaToValibot(schema) // No options = default behavior

      // Should export the Profile definition by default
      expect(result).toContain('export const Profile = v.object({')
      expect(result).toContain('"profile": v.optional(Profile)')
    })
  })

  describe('additionalProperties with properties', () => {
    it('should combine properties with additionalProperties schema using v.objectWithRest', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          age: { type: 'number' as const },
        },
        required: ['name'],
        additionalProperties: {
          type: 'string' as const,
        },
      }
      const result = jsonSchemaToValibot(schema)

      // v.objectWithRest validates declared keys with the shape and other keys with the rest schema
      expect(result).toContain('v.objectWithRest({')
      expect(result).toContain('"name": v.string()')
      expect(result).toContain('"age": v.optional(v.number())')
      expect(result).toContain('}, v.string())')
    })

    it('should handle additionalProperties: false with strictObject', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
        },
        additionalProperties: false,
      }
      const result = jsonSchemaToValibot(schema)

      // Should use v.strictObject when additionalProperties is false
      expect(result).toContain('v.strictObject({')
      expect(result).toContain('"name": v.optional(v.string())')
    })

    it('should handle additionalProperties schema without properties using v.record', () => {
      const schema = {
        type: 'object' as const,
        additionalProperties: {
          type: 'number' as const,
        },
      }
      const result = jsonSchemaToValibot(schema)

      // Should use v.record with an explicit string key schema when only additionalProperties is specified
      expect(result).toContain('v.record(v.string(), v.number())')
    })

    it('should handle complex additionalProperties with nested schema', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const },
        },
        required: ['id'],
        additionalProperties: {
          type: 'object' as const,
          properties: {
            value: { type: 'string' as const },
            metadata: { type: 'object' as const },
          },
        },
      }
      const result = jsonSchemaToValibot(schema)

      // Should combine properties with complex additionalProperties
      expect(result).toContain('v.objectWithRest({')
      expect(result).toContain('"id": v.string()')
      expect(result).toContain('}, v.object({') // Based on actual output
      expect(result).toContain('"value": v.optional(v.string())')
      expect(result).toContain('"metadata": v.optional(v.object({}))')
    })

    it('should reject additional properties that violate the rest schema', async () => {
      const schema = {
        type: 'object' as const,
        properties: { name: { type: 'string' as const } },
        required: ['name'],
        additionalProperties: { type: 'number' as const },
      }

      expect(await accepts(schema, { name: 'a', extra: 1 })).toBe(true)
      expect(await accepts(schema, { name: 'a', extra: 'nope' })).toBe(false)
    })

    it('should validate record values when only additionalProperties is set', async () => {
      const schema = {
        type: 'object' as const,
        additionalProperties: { type: 'number' as const },
      }

      expect(await accepts(schema, { a: 1, b: 2 })).toBe(true)
      expect(await accepts(schema, { a: 'x' })).toBe(false)
    })
  })

  describe('keyword-based type inference (no explicit type)', () => {
    it('should infer number from numeric constraints', async () => {
      const schema = { minimum: 1.1 }
      const result = jsonSchemaToValibot(schema)

      expect(result).toContain('v.pipe(v.number(), v.minValue(1.1))')
      expect(await accepts(schema, 2)).toBe(true)
      expect(await accepts(schema, 0.6)).toBe(false)
    })

    it('should infer string from string constraints', async () => {
      const schema = { maxLength: 3 }

      expect(jsonSchemaToValibot(schema)).toContain('v.pipe(v.string(), v.maxLength(3))')
      expect(await accepts(schema, 'abc')).toBe(true)
      expect(await accepts(schema, 'abcd')).toBe(false)
    })

    it('should infer array from array constraints', async () => {
      const schema = { items: { type: 'number' as const } }

      expect(jsonSchemaToValibot(schema)).toContain('v.array(v.number())')
      expect(await accepts(schema, [1, 2])).toBe(true)
      expect(await accepts(schema, ['x'])).toBe(false)
    })

    it('should infer object from object keywords', async () => {
      const schema = {
        properties: { foo: { type: 'integer' as const } },
        required: ['foo'],
      }

      expect(jsonSchemaToValibot(schema)).toContain('v.object({')
      expect(await accepts(schema, { foo: 1 })).toBe(true)
      expect(await accepts(schema, { foo: 'x' })).toBe(false)
      expect(await accepts(schema, {})).toBe(false)
    })

    it('should infer a union when keywords span multiple types', async () => {
      const schema = { minLength: 1, minimum: 0 }

      expect(jsonSchemaToValibot(schema)).toContain('v.union([')
      expect(await accepts(schema, 'ab')).toBe(true)
      expect(await accepts(schema, 5)).toBe(true)
    })

    it('should fall back to v.any() when no type can be inferred', async () => {
      const result = jsonSchemaToValibot({})

      expect(result).toContain('v.any()')
    })
  })

  describe('composition combining', () => {
    it('should intersect allOf object subschemas without explicit type', async () => {
      const schema: JsonSchema = {
        allOf: [
          { properties: { a: { type: 'number' as const } }, required: ['a'] },
          { properties: { b: { type: 'string' as const } }, required: ['b'] },
        ],
      }

      expect(jsonSchemaToValibot(schema)).toContain('v.intersect([')
      expect(await accepts(schema, { a: 1, b: 'x' })).toBe(true)
      expect(await accepts(schema, { a: 1 })).toBe(false)
      expect(await accepts(schema, { b: 'x' })).toBe(false)
    })

    it('should combine sibling base constraints with allOf', async () => {
      const schema = {
        properties: { bar: { type: 'integer' as const } },
        required: ['bar'],
        allOf: [{ properties: { foo: { type: 'string' as const } }, required: ['foo'] }],
      }

      expect(jsonSchemaToValibot(schema)).toContain('v.intersect([')
      expect(await accepts(schema, { foo: 'x', bar: 1 })).toBe(true)
      expect(await accepts(schema, { bar: 1 })).toBe(false)
      expect(await accepts(schema, { foo: 'x' })).toBe(false)
    })

    it('should combine multiple composition keywords on one schema', async () => {
      const schema = {
        allOf: [{ multipleOf: 2 }],
        anyOf: [{ multipleOf: 3 }],
      }

      expect(jsonSchemaToValibot(schema)).toContain('v.intersect([')
      expect(await accepts(schema, 6)).toBe(true)
      expect(await accepts(schema, 2)).toBe(false)
    })
  })

  describe('numeric exclusive bounds', () => {
    it('should use v.gtValue for exclusiveMinimum', async () => {
      const schema = { type: 'number' as const, exclusiveMinimum: 1.1 }

      expect(jsonSchemaToValibot(schema)).toContain('v.gtValue(1.1)')
      expect(await accepts(schema, 1.1)).toBe(false)
      expect(await accepts(schema, 1.2)).toBe(true)
    })

    it('should use v.ltValue for exclusiveMaximum', async () => {
      const schema = { type: 'number' as const, exclusiveMaximum: 3 }

      expect(jsonSchemaToValibot(schema)).toContain('v.ltValue(3)')
      expect(await accepts(schema, 3)).toBe(false)
      expect(await accepts(schema, 2)).toBe(true)
    })
  })

  describe('array tuples', () => {
    it('should map prefixItems to v.tupleWithRest allowing extra items', async () => {
      const schema = {
        type: 'array' as const,
        prefixItems: [{ type: 'string' as const }, { type: 'number' as const }],
      }

      expect(jsonSchemaToValibot(schema)).toContain('v.tupleWithRest([v.string(), v.number()],')
      expect(await accepts(schema, ['x', 1])).toBe(true)
      expect(await accepts(schema, [1, 'x'])).toBe(false)
      expect(await accepts(schema, ['x', 1, true])).toBe(true)
    })

    it('should map prefixItems with items:false to v.strictTuple', async () => {
      const schema = {
        type: 'array' as const,
        prefixItems: [{ type: 'string' as const }],
        items: false as const,
      }

      expect(jsonSchemaToValibot(schema)).toContain('v.strictTuple([v.string()])')
      expect(await accepts(schema, ['x'])).toBe(true)
      expect(await accepts(schema, ['x', 1])).toBe(false)
    })

    it('should map prefixItems with an items schema to v.tupleWithRest', async () => {
      const schema = {
        type: 'array' as const,
        prefixItems: [{ type: 'string' as const }],
        items: { type: 'number' as const },
      }

      expect(await accepts(schema, ['x', 1, 2])).toBe(true)
      expect(await accepts(schema, ['x', 'y'])).toBe(false)
    })

    it('should map items:false to an empty strict tuple', async () => {
      const schema = { type: 'array' as const, items: false as const }

      expect(jsonSchemaToValibot(schema)).toContain('v.strictTuple([])')
      expect(await accepts(schema, [])).toBe(true)
      expect(await accepts(schema, [1])).toBe(false)
    })
  })

  describe('enum and const edge cases', () => {
    it('should convert an empty enum to v.never()', async () => {
      const schema = { enum: [] }

      expect(jsonSchemaToValibot(schema)).toContain('v.never()')
      expect(await accepts(schema, 'anything')).toBe(false)
      expect(await accepts(schema, null)).toBe(false)
    })

    it('should convert const objects to v.strictObject', async () => {
      const schema = { const: { a: 1 } }

      expect(jsonSchemaToValibot(schema)).toContain('v.strictObject({')
      expect(await accepts(schema, { a: 1 })).toBe(true)
      expect(await accepts(schema, { a: 1, b: 2 })).toBe(false)
    })
  })

  describe('required keys without a property schema', () => {
    it('should enforce presence of required keys via v.unknown()', async () => {
      const schema = { type: 'object' as const, required: ['foo'] }

      expect(jsonSchemaToValibot(schema)).toContain('"foo": v.unknown()')
      expect(await accepts(schema, { foo: 1 })).toBe(true)
      expect(await accepts(schema, { foo: null })).toBe(true)
      expect(await accepts(schema, {})).toBe(false)
    })
  })

  describe('string pattern', () => {
    it('should add the u flag so Unicode property escapes work', async () => {
      const schema = { type: 'string' as const, pattern: '^\\p{Letter}+$' }

      expect(jsonSchemaToValibot(schema)).toContain('/^\\p{Letter}+$/u')
      expect(await accepts(schema, 'Hello')).toBe(true)
      expect(await accepts(schema, '123')).toBe(false)
    })
  })

  describe('definition ordering', () => {
    it('should declare referenced definitions before their dependents', async () => {
      const schema = {
        type: 'object' as const,
        properties: { item: { $ref: '#/$defs/item' } },
        $defs: {
          item: {
            type: 'object' as const,
            properties: { sub: { $ref: '#/$defs/subItem' } },
            required: ['sub'],
          },
          subItem: {
            type: 'object' as const,
            properties: { foo: { type: 'string' as const } },
            required: ['foo'],
          },
        },
      }
      const result = jsonSchemaToValibot(schema)

      // subItem is referenced by item, so it must be declared first (no TDZ error).
      expect(result.indexOf('const subItem')).toBeLessThan(result.indexOf('const item'))
      expect(await accepts(schema, { item: { sub: { foo: 'x' } } })).toBe(true)
      expect(await accepts(schema, { item: { sub: {} } })).toBe(false)
    })
  })
})
