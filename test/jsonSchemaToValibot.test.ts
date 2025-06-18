import { describe, it, expect } from 'vitest'
import { jsonSchemaToValibot } from '../src/jsonSchemaToValibot'

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
      pattern: '^[a-z]+$'
    }
    const result = jsonSchemaToValibot(schema)
    
    expect(result).toContain('v.string([v.minLength(5), v.maxLength(100), v.regex(/^[a-z]+$/)])')
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
      maximum: 100
    }
    const result = jsonSchemaToValibot(schema)
    
    expect(result).toContain('v.integer([v.minValue(0), v.maxValue(100)])')
  })
  
  it('should convert boolean schema', () => {
    const schema = { type: 'boolean' as const }
    const result = jsonSchemaToValibot(schema)
    
    expect(result).toContain('const schema = v.boolean()')
  })
  
  it('should convert array schema', () => {
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const }
    }
    const result = jsonSchemaToValibot(schema)
    
    expect(result).toContain('v.array(v.string())')
  })
  
  it('should convert object schema', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const },
        age: { type: 'number' as const }
      },
      required: ['name']
    }
    const result = jsonSchemaToValibot(schema)
    
    expect(result).toContain('v.object({')
    expect(result).toContain('"name": v.string()')
    expect(result).toContain('"age": v.optional(v.number())')
  })
  
  it('should convert enum schema', () => {
    const schema = {
      enum: ['red', 'green', 'blue']
    }
    const result = jsonSchemaToValibot(schema)
    
    expect(result).toContain('v.picklist(["red", "green", "blue"])')
  })
  
  it('should convert const schema', () => {
    const schema = {
      const: 'hello'
    }
    const result = jsonSchemaToValibot(schema)
    
    expect(result).toContain('v.literal("hello")')
  })
  
  it('should convert anyOf schema', () => {
    const schema = {
      anyOf: [
        { type: 'string' as const },
        { type: 'number' as const }
      ]
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
})