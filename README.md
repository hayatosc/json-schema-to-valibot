# json-schema-to-valibot

Convert JSON Schema definitions to [Valibot](https://valibot.dev/) schema definitions.

## Installation

```bash
pnpm install json-schema-to-valibot
```

## CLI Usage

```bash
# Convert from file
json-schema-to-valibot -i schema.json

# Convert from stdin
cat schema.json | json-schema-to-valibot

# Direct JSON input
json-schema-to-valibot -i '{"type":"string","minLength":5}'

# Specify output file
json-schema-to-valibot -i schema.json -o output.ts

# Generate CommonJS module
json-schema-to-valibot -i schema.json --module cjs

# Generate TypeScript types
json-schema-to-valibot -i schema.json --types

# Custom schema name
json-schema-to-valibot -i schema.json --name userSchema
```

### CLI Options

- `-i, --input <path>` - Input JSON Schema file path or JSON string
- `-o, --output <path>` - Output file path (defaults to stdout)  
- `-n, --name <name>` - Schema name in output (default: "schema")
- `-m, --module <type>` - Module system: esm, cjs, none (default: "esm")
- `-t, --types` - Generate TypeScript type exports
- `-d, --jsdoc` - Include JSDoc comments
- `--depth <number>` - Maximum recursion depth (default: 10)

## Programmatic Usage

```typescript
import { jsonSchemaToValibot } from 'json-schema-to-valibot'

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    age: { type: 'integer', minimum: 0 }
  },
  required: ['name']
}

const valibotCode = jsonSchemaToValibot(schema, {
  name: 'userSchema',
  module: 'esm',
  withTypes: true
})

console.log(valibotCode)
```

## Supported JSON Schema Features

### Basic Types
- `string` with constraints (minLength, maxLength, pattern, format)
- `number`/`integer` with constraints (minimum, maximum, multipleOf)
- `boolean`
- `null`
- `array` with items, length constraints, uniqueItems
- `object` with properties, required fields, additionalProperties

### Advanced Features  
- `const` values → `v.literal()`
- `enum` values → `v.picklist()`
- `anyOf` → `v.union()`
- `allOf` → `v.intersect()` (for objects)
- `oneOf` → `v.union()`
- `not` → `v.custom()` validation
- `nullable` → `v.nullable()`

### String Formats
- `email` → `v.email()`
- `url`/`uri` → `v.url()`
- `uuid` → `v.uuid()`
- `date` → `v.isoDate()`
- `date-time` → `v.isoDateTime()`
- `time` → `v.isoTime()`
- `ipv4` → `v.ipv4()`
- `ipv6` → `v.ipv6()`

## Examples

### Input JSON Schema
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "email": {
      "type": "string", 
      "format": "email"
    },
    "age": {
      "type": "integer",
      "minimum": 0,
      "maximum": 150
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "uniqueItems": true
    }
  },
  "required": ["name", "email"]
}
```

### Generated Valibot Schema
```typescript
import * as v from 'valibot'

export const schema = v.object({
  "name": v.string([v.minLength(1), v.maxLength(100)]),
  "email": v.string([v.email()]),
  "age": v.optional(v.integer([v.minValue(0), v.maxValue(150)])),
  "tags": v.optional(v.pipe(v.array(v.string()), v.unique()))
})
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build
pnpm build

# Development CLI
pnpm dev -i example-schema.json
```

## License

MIT