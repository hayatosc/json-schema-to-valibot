import { describe, it, expect } from 'vitest'

describe('End-to-End CLI Tests', () => {
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
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
        include: [testOutputFile],
      };

      writeFileSync(tempTsConfig, JSON.stringify(tempTsConfigContent, null, 2));

      // Type check the generated file
      try {
        execSync(`npx tsc --noEmit --project ${tempTsConfig}`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10000,
        });
        // If we get here, type checking passed
      } catch (typeError: any) {
        console.error('TypeScript compilation failed:');
        console.error(typeError.stdout);
        console.error(typeError.stderr);
        throw new Error(`Generated code failed TypeScript type checking: ${typeError.message}`);
      }

    } finally {
      // Clean up test files
      if (existsSync(testOutputFile)) {
        unlinkSync(testOutputFile);
      }
      if (existsSync(tempTsConfig)) {
        unlinkSync(tempTsConfig);
      }
    }
  });
});