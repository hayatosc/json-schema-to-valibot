import { type JsonSchemaObject, type ParserContext, type ParseResult } from '../types';
import { parseSchema } from './parseSchema';

export function parseObject(schema: JsonSchemaObject, context: ParserContext): ParseResult {
  const imports = new Set(['object']);

  // Parse properties
  const properties: Record<string, string> = {};
  const propertyTypes: Record<string, string> = {};
  const allImports = new Set(imports);

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propResult = parseSchema(propSchema, {
        ...context,
        depth: context.depth + 1,
        currentPath: [...context.currentPath, key],
      });

      properties[key] = propResult.schema;
      propertyTypes[key] = propResult.types || 'any';

      // Add imports from property schemas
      propResult.imports.forEach((imp) => allImports.add(imp));
    }
  }

  // Handle required properties
  const required = schema.required || [];

  // Build properties object
  const propsEntries = Object.entries(properties).map(([key, propSchema]) => {
    const isRequired = required.includes(key);

    if (isRequired) {
      return `${JSON.stringify(key)}: ${propSchema}`;
    } else {
      // Optional property - wrap with v.optional
      allImports.add('optional');
      return `${JSON.stringify(key)}: v.optional(${propSchema})`;
    }
  });

  const propsObject = propsEntries.length > 0 ? `{ ${propsEntries.join(', ')} }` : '{}';

  // Handle additionalProperties
  let schemaStr = `v.object(${propsObject})`;

  if (schema.additionalProperties === false) {
    // Strict object - no additional properties allowed
    schemaStr = `v.strictObject(${propsObject})`;
    allImports.add('strictObject');
    allImports.delete('object');
  } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    // Additional properties with specific schema
    const additionalResult = parseSchema(schema.additionalProperties, {
      ...context,
      depth: context.depth + 1,
    });

    schemaStr = `v.record(${additionalResult.schema})`;
    allImports.add('record');
    additionalResult.imports.forEach((imp) => allImports.add(imp));
  }

  // Build TypeScript type
  const typeEntries = Object.entries(propertyTypes).map(([key, type]) => {
    const isRequired = required.includes(key);
    const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    return isRequired ? `${keyStr}: ${type}` : `${keyStr}?: ${type}`;
  });

  const objectType = typeEntries.length > 0 ? `{ ${typeEntries.join(', ')} }` : '{}';

  return {
    schema: schemaStr,
    imports: allImports,
    types: objectType,
  };
}
