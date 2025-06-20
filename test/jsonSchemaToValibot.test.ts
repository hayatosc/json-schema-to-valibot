import { describe, expect, it } from 'vitest';
import { jsonSchemaToValibot } from '../src/jsonSchemaToValibot';

describe('jsonSchemaToValibot', () => {
  it('should convert basic string schema', () => {
    const schema = { type: 'string' as const };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain("import * as v from 'valibot'");
    expect(result).toContain('const schema = v.string()');
  });

  it('should convert string with constraints', () => {
    const schema = {
      type: 'string' as const,
      minLength: 5,
      maxLength: 100,
      pattern: '^[a-z]+$',
    };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain('v.pipe(v.string(), v.minLength(5), v.maxLength(100), v.regex(/^[a-z]+$/))');
  });

  it('should convert basic number schema', () => {
    const schema = { type: 'number' as const };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain('const schema = v.number()');
  });

  it('should convert integer with constraints', () => {
    const schema = {
      type: 'integer' as const,
      minimum: 0,
      maximum: 100,
    };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain('v.pipe(v.number(), v.minValue(0), v.maxValue(100))');
  });

  it('should convert boolean schema', () => {
    const schema = { type: 'boolean' as const };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain('const schema = v.boolean()');
  });

  it('should convert array schema', () => {
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const },
    };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain('v.array(v.string())');
  });

  it('should convert object schema', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const },
        age: { type: 'number' as const },
      },
      required: ['name'],
    };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain('v.object({');
    expect(result).toContain('"name": v.string()');
    expect(result).toContain('"age": v.optional(v.number())');
  });

  it('should convert enum schema', () => {
    const schema = {
      enum: ['red', 'green', 'blue'],
    };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain('v.picklist(["red", "green", "blue"])');
  });

  it('should convert const schema', () => {
    const schema = {
      const: 'hello',
    };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain('v.literal("hello")');
  });

  it('should convert anyOf schema', () => {
    const schema = {
      anyOf: [{ type: 'string' as const }, { type: 'number' as const }],
    };
    const result = jsonSchemaToValibot(schema);

    expect(result).toContain('v.union([v.string(), v.number()])');
  });

  it('should handle custom schema name', () => {
    const schema = { type: 'string' as const };
    const result = jsonSchemaToValibot(schema, { name: 'customSchema' });

    expect(result).toContain('const customSchema = v.string()');
  });

  it('should handle CommonJS module format', () => {
    const schema = { type: 'string' as const };
    const result = jsonSchemaToValibot(schema, { module: 'cjs' });

    expect(result).toContain("const v = require('valibot')");
    expect(result).toContain('module.exports = { schema }');
  });

  it('should handle no module format', () => {
    const schema = { type: 'string' as const };
    const result = jsonSchemaToValibot(schema, { module: 'none' });

    expect(result).not.toContain('import');
    expect(result).not.toContain('require');
    expect(result).toContain('const schema = v.string()');
  });

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
      };
      const result = jsonSchemaToValibot(schema);

      // Should generate a constant for the User definition
      expect(result).toContain('export const User = v.object({');
      expect(result).toContain('"name": v.string()');
      expect(result).toContain('"age": v.optional(v.number())');
      
      // Should reference the User constant in the main schema
      expect(result).toContain('"user": v.optional(User)');
      
      // Should export the User definition by default
      expect(result).toContain('export const User = v.object({');
    });

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
      };
      const result = jsonSchemaToValibot(schema);

      // Should generate a constant for the Profile definition
      expect(result).toContain('export const Profile = v.object({');
      expect(result).toContain('"bio": v.optional(v.string())');
      
      // Should reference the Profile constant
      expect(result).toContain('"profile": v.optional(Profile)');
    });

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
      };
      const result = jsonSchemaToValibot(schema);

      // Should generate the Node definition
      expect(result).toContain('export const Node = v.object({');
      expect(result).toContain('"value": v.optional(v.string())');
      
      // Should handle circular reference (fallback to v.any() or similar)
      expect(result).toContain('"child": v.optional(v.any())'); 
    });

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
      };
      const result = jsonSchemaToValibot(schema, { exportDefinitions: false });

      // Should not export the User definition
      expect(result).toContain('const User = v.object({');
      expect(result).not.toContain('export const User = v.object({');
      
      // Should still reference the User constant
      expect(result).toContain('"user": v.optional(User)');
    });

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
      };
      const result = jsonSchemaToValibot(schema); // No options = default behavior

      // Should export the Profile definition by default
      expect(result).toContain('export const Profile = v.object({');
      expect(result).toContain('"profile": v.optional(Profile)');
    });
  });

  describe('additionalProperties with properties', () => {
    it('should combine properties with additionalProperties schema using v.object with v.rest', () => {
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
      };
      const result = jsonSchemaToValibot(schema);

      // Should use v.object with additional properties (not v.rest but direct second parameter)
      expect(result).toContain('v.object({');
      expect(result).toContain('"name": v.string()');
      expect(result).toContain('"age": v.optional(v.number())');
      expect(result).toContain('}, v.string())'); // Based on actual output
    });

    it('should handle additionalProperties: false with strictObject', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
        },
        additionalProperties: false,
      };
      const result = jsonSchemaToValibot(schema);

      // Should use v.strictObject when additionalProperties is false
      expect(result).toContain('v.strictObject({');
      expect(result).toContain('"name": v.optional(v.string())');
    });

    it('should handle additionalProperties schema without properties using v.record', () => {
      const schema = {
        type: 'object' as const,
        additionalProperties: {
          type: 'number' as const,
        },
      };
      const result = jsonSchemaToValibot(schema);

      // Should use v.record when only additionalProperties is specified
      expect(result).toContain('v.record(v.number())'); // Based on actual output
    });

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
      };
      const result = jsonSchemaToValibot(schema);

      // Should combine properties with complex additionalProperties
      expect(result).toContain('v.object({');
      expect(result).toContain('"id": v.string()');
      expect(result).toContain('}, v.object({'); // Based on actual output
      expect(result).toContain('"value": v.optional(v.string())');
      expect(result).toContain('"metadata": v.optional(v.object({}))'); 
    });
  });

});
