# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `pnpm dev -i example-schema.json` - Run CLI in development mode
- `pnpm test` - Run test suite with Vitest
- `pnpm test:ui` - Run tests with UI interface
- `pnpm typecheck` - TypeScript type checking
- `pnpm lint` - ESLint linting
- `pnpm lint:fix` - Fix linting issues automatically
- `pnpm build` - Build all distribution files (CJS, ESM, CLI)

### Testing Single Files
- `pnpm test -- jsonSchemaToValibot.test.ts` - Run specific test file
- `pnpm test:dev` - Run unit tests (excludes end-to-end tests)
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm test:suite` - Run JSON Schema test suite validation

## Architecture

This is a JSON Schema to Valibot converter with both CLI and programmatic interfaces.

### Core Components

1. **Main Converter** (`src/jsonSchemaToValibot.ts`): Primary conversion function that orchestrates the entire process
2. **Parser System** (`src/parsers/`): Modular parsers for different JSON Schema constructs:
   - `parseSchema.ts` - Main parser dispatcher with recursion protection
   - Type-specific parsers: `parseString.ts`, `parseNumber.ts`, `parseObject.ts`, etc.
   - Composition parsers: `parseAllOf.ts`, `parseAnyOf.ts`, `parseOneOf.ts`
3. **CLI Interface** (`src/cli.ts`): Command-line interface using Citty
4. **Type Definitions** (`src/types.ts`): Core interfaces for JsonSchema, ConversionOptions, ParserContext

### Key Design Patterns

- **Parser Context**: Tracks recursion depth, references, and current path to prevent infinite loops
- **Modular Parsing**: Each JSON Schema construct has its own parser for maintainability
- **Import Tracking**: ParseResult includes import sets to generate clean Valibot imports
- **Module System Support**: Generates ESM, CJS, or standalone code based on options

### Build System

Uses Rolldown with a single configuration that builds three outputs:
- Library (CJS and ESM formats)
- CLI executable with shebang

### Testing

Uses Vitest for testing. Test files are in `test/` directory.
- `jsonSchemaToValibot.test.ts` - Unit tests for core conversion functionality
- `end-to-end.test.ts` - End-to-end CLI tests
- `script/test-suite-runner.ts` - Validates against official JSON Schema test suite

## Design Principles

### Specification Conflicts
When JSON Schema and Valibot specifications conflict, prioritize clean Valibot-idiomatic code over strict JSON Schema compliance. Accept test failures rather than implementing complex workarounds that compromise code quality or Valibot's design philosophy.