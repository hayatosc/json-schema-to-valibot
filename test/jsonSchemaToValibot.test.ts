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

  it('should work end-to-end with CLI and pass TypeScript type checking', async () => {
    const { execSync } = await import('child_process');
    const { readFileSync, unlinkSync, existsSync, writeFileSync } = await import('fs');
    const { resolve } = await import('path');

    // Clean up any existing test files
    const testOutputFile = 'test-cli-output.ts';
    const tempTsConfig = 'temp-tsconfig.json';

    if (existsSync(testOutputFile)) {
      unlinkSync(testOutputFile);
    }
    if (existsSync(tempTsConfig)) {
      unlinkSync(tempTsConfig);
    }

    try {
      // Generate schema using CLI
      execSync(`node ./dist/cli.cjs -i example-schema.json -o ${testOutputFile}`, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000,
      });

      // Verify file was created
      expect(existsSync(testOutputFile)).toBe(true);

      // Read and verify the generated content
      const generatedContent = readFileSync(testOutputFile, 'utf8');

      // Check that it contains expected Valibot imports and schema
      expect(generatedContent).toContain("import * as v from 'valibot'");
      expect(generatedContent).toContain('export const schema = v.object({');
      expect(generatedContent).toContain('v.pipe(v.string(), v.minLength(1), v.maxLength(100))');
      expect(generatedContent).toContain('v.pipe(v.string(), v.email())');
      expect(generatedContent).toContain('v.optional(');

      // Create a minimal tsconfig.json for type checking
      const tempTsConfigContent = {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'node',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
        include: [testOutputFile],
        exclude: ['node_modules'],
      };

      writeFileSync(tempTsConfig, JSON.stringify(tempTsConfigContent, null, 2));

      // Run TypeScript type check on generated file with custom config
      let typecheckPassed = false;
      try {
        const result = execSync(`pnpm tsc --project ${tempTsConfig}`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 30000,
          cwd: process.cwd(),
        });
        typecheckPassed = true;
      } catch (error: any) {
        // Log detailed error information
        console.error('TypeScript compilation failed:');
        console.error('stdout:', error.stdout);
        console.error('stderr:', error.stderr);
        console.error('Generated file content:', generatedContent);
        throw new Error(`TypeScript type check failed: ${error.stderr || error.stdout || error.message}`);
      }

      expect(typecheckPassed).toBe(true);
    } finally {
      // Clean up
      if (existsSync(testOutputFile)) {
        unlinkSync(testOutputFile);
      }
      if (existsSync(tempTsConfig)) {
        unlinkSync(tempTsConfig);
      }
    }
  }, 45000);
});
