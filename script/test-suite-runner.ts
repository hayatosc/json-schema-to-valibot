#!/usr/bin/env node

import fs, { unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { jsonSchemaToValibot } from '../dist/index.js';

const TEST_SUITE_DIR = './json-schema-test-suite/tests';
const DRAFT_VERSION = 'draft2020-12';

const TEST_CATEGORIES = [
  'type',
  'properties',
  'required',
  'additionalProperties',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'pattern',
  'enum',
  'const',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
  'multipleOf',
  'exclusiveMinimum',
  'exclusiveMaximum',
];

interface TestCase {
  description: string;
  data: any;
  valid: boolean;
}

interface SchemaTest {
  description: string;
  schema: any;
  tests: TestCase[];
}

interface TestResult {
  category: string;
  schema: string;
  test: string;
  input: string;
  expected: boolean;
  actual: boolean;
  status: 'PASS' | 'FAIL' | 'ERROR';
  error?: string;
}

interface CategoryStats {
  category: string;
  total: number;
  passed: number;
  failed: number;
  errors: number;
  passRate: number;
}

async function createValidator(valibotCode: string): Promise<(data: any) => boolean> {
  const tempFile = path.join(process.cwd(), `temp-validator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.mjs`);

  try {
    const cleanCode = valibotCode.replace(/import \* as v from ['"]valibot['"];?\s*/, '').replace(/export const schema = /, 'const schema = ');

    const moduleCode = `
import * as v from 'valibot';

${cleanCode}

export function validate(data) {
  try {
    v.parse(schema, data);
    return true;
  } catch (error) {
    return false;
  }
}
`;

    writeFileSync(tempFile, moduleCode);
    const module = await import(`file://${tempFile}`);
    return module.validate;
  } finally {
    if (fs.existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  }
}

class TestSuiteRunner {
  private results: TestResult[] = [];
  private categoryStats: CategoryStats[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Running JSON Schema Test Suite...\n');

    for (const category of TEST_CATEGORIES) {
      const testFile = path.join(TEST_SUITE_DIR, DRAFT_VERSION, `${category}.json`);

      if (!fs.existsSync(testFile)) {
        console.log(`⚠️  Skipping ${category}: file not found`);
        continue;
      }

      console.log(`📋 Testing ${category}...`);
      await this.runCategoryTests(category, testFile);
    }

    this.calculateStats();
    this.printReport();
  }

  async runCategoryTests(category: string, testFile: string): Promise<void> {
    const testData: SchemaTest[] = JSON.parse(fs.readFileSync(testFile, 'utf8'));

    for (const schemaTest of testData) {
      try {
        const valibotCode = jsonSchemaToValibot(schemaTest.schema);
        const validator = await createValidator(valibotCode);

        for (const testCase of schemaTest.tests) {
          try {
            const actual = validator(testCase.data);
            const status = actual === testCase.valid ? 'PASS' : 'FAIL';

            this.results.push({
              category,
              schema: schemaTest.description,
              test: testCase.description,
              input: JSON.stringify(testCase.data),
              expected: testCase.valid,
              actual,
              status,
            });
          } catch (error) {
            this.results.push({
              category,
              schema: schemaTest.description,
              test: testCase.description,
              input: JSON.stringify(testCase.data),
              expected: testCase.valid,
              actual: false,
              status: 'ERROR',
              error: (error as Error).message,
            });
          }
        }
      } catch (conversionError) {
        for (const testCase of schemaTest.tests) {
          this.results.push({
            category,
            schema: schemaTest.description,
            test: testCase.description,
            input: JSON.stringify(testCase.data),
            expected: testCase.valid,
            actual: false,
            status: 'ERROR',
            error: `Schema conversion failed: ${(conversionError as Error).message}`,
          });
        }
      }
    }
  }

  private calculateStats(): void {
    const categories = [...new Set(this.results.map((r) => r.category))];

    this.categoryStats = categories
      .map((category) => {
        const categoryResults = this.results.filter((r) => r.category === category);
        const passed = categoryResults.filter((r) => r.status === 'PASS').length;
        const failed = categoryResults.filter((r) => r.status === 'FAIL').length;
        const errors = categoryResults.filter((r) => r.status === 'ERROR').length;
        const total = categoryResults.length;
        const passRate = total > 0 ? (passed / total) * 100 : 0;

        return {
          category,
          total,
          passed,
          failed,
          errors,
          passRate,
        };
      })
      .sort((a, b) => b.passRate - a.passRate);
  }

  private printReport(): void {
    const totalTests = this.results.length;
    const totalPassed = this.results.filter((r) => r.status === 'PASS').length;
    const totalFailed = this.results.filter((r) => r.status === 'FAIL').length;
    const totalErrors = this.results.filter((r) => r.status === 'ERROR').length;
    const overallPassRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    console.log('\n' + '='.repeat(80));
    console.log('📊 JSON Schema Test Suite Results');
    console.log('='.repeat(80));

    console.log(`\n🎯 Overall Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${totalPassed} (${overallPassRate.toFixed(1)}%)`);
    console.log(`   Failed: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(1)}%)`);
    console.log(`   Errors: ${totalErrors} (${((totalErrors / totalTests) * 100).toFixed(1)}%)`);

    console.log(`\n📋 Results by Category:`);
    console.log('Category'.padEnd(20) + 'Total'.padEnd(8) + 'Pass'.padEnd(8) + 'Fail'.padEnd(8) + 'Error'.padEnd(8) + 'Pass Rate');
    console.log('-'.repeat(70));

    this.categoryStats.forEach((stat) => {
      const line =
        stat.category.padEnd(20) +
        stat.total.toString().padEnd(8) +
        stat.passed.toString().padEnd(8) +
        stat.failed.toString().padEnd(8) +
        stat.errors.toString().padEnd(8) +
        `${stat.passRate.toFixed(1)}%`;
      console.log(line);
    });

    // Show ERROR test details first
    const errorResults = this.results.filter((r) => r.status === 'ERROR');
    if (errorResults.length > 0) {
      console.log(`\n🚨 ERROR Test Results (${errorResults.length} errors):`);
      console.log('Category'.padEnd(15) + 'Schema'.padEnd(40) + 'Test'.padEnd(40) + 'Error');
      console.log('-'.repeat(150));

      errorResults.forEach((result) => {
        const truncatedSchema = result.schema.length > 38 ? result.schema.substring(0, 35) + '...' : result.schema;
        const truncatedTest = result.test.length > 38 ? result.test.substring(0, 35) + '...' : result.test;

        const line = result.category.padEnd(15) + truncatedSchema.padEnd(40) + truncatedTest.padEnd(40) + (result.error || 'Unknown error');
        console.log(line);
      });
    }

    // Only show detailed results for failed tests to reduce noise
    const failedResults = this.results.filter((r) => r.status === 'FAIL');
    if (failedResults.length > 0) {
      console.log(`\n❌ Failed Test Results (${failedResults.length} failures):`);
      console.log(
        'Category'.padEnd(15) + 'Schema'.padEnd(30) + 'Test'.padEnd(35) + 'Input'.padEnd(20) + 'Expected'.padEnd(9) + 'Actual'.padEnd(7) + 'Status'
      );
      console.log('-'.repeat(130));

      failedResults.slice(0, 50).forEach((result) => {
        // Limit to first 50 failures
        const truncatedSchema = result.schema.length > 28 ? result.schema.substring(0, 25) + '...' : result.schema;
        const truncatedTest = result.test.length > 33 ? result.test.substring(0, 30) + '...' : result.test;
        const truncatedInput = result.input.length > 18 ? result.input.substring(0, 15) + '...' : result.input;

        const line =
          result.category.padEnd(15) +
          truncatedSchema.padEnd(30) +
          truncatedTest.padEnd(35) +
          truncatedInput.padEnd(20) +
          result.expected.toString().padEnd(9) +
          result.actual.toString().padEnd(7) +
          result.status;
        console.log(line);
      });

      if (failedResults.length > 50) {
        console.log(`... and ${failedResults.length - 50} more failures`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✅ Test completed. Overall pass rate: ${overallPassRate.toFixed(1)}%`);
    console.log('='.repeat(80));

    // Output structured data for CI parsing
    console.log('\n--- CI_STATS ---');
    console.log(`TOTAL_TESTS=${totalTests}`);
    console.log(`PASSED_TESTS=${totalPassed}`);
    console.log(`FAILED_TESTS=${totalFailed}`);
    console.log(`ERROR_TESTS=${totalErrors}`);
    console.log(`PASS_RATE=${overallPassRate.toFixed(1)}`);
    console.log('--- END_CI_STATS ---');
  }
}

// Run the tests
const runner = new TestSuiteRunner();
runner.runAllTests().catch(console.error);
