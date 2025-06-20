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
  let schemaStr: string;

  if (schema.additionalProperties === false) {
    // Strict object - no additional properties allowed beyond those in `properties`
    schemaStr = `v.strictObject(${propsObject})`;
    allImports.add('strictObject');
    allImports.delete('object'); // v.object might have been added by default
  } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    // Additional properties are allowed and must conform to a specific schema
    const additionalPropsSchema = schema.additionalProperties as JsonSchemaObject; // Cast for type safety
    const additionalResult = parseSchema(additionalPropsSchema, {
      ...context,
      depth: context.depth + 1, // Ensure depth is managed for nested parsing
      currentPath: [...context.currentPath, 'additionalProperties'], // Update current path
    });

    additionalResult.imports.forEach((imp) => allImports.add(imp));

    if (propsEntries.length > 0) {
      // Both properties and additionalProperties (as schema) are defined
      // Use v.object(shape, rest)
      schemaStr = `v.object(${propsObject}, ${additionalResult.schema})`;
      // v.object is already in allImports by default or will be added.
      // The 'rest' argument for v.object doesn't require a separate 'v.rest' import,
      // it's a part of v.object's signature.
    } else {
      // Only additionalProperties (as schema) is defined, no specific properties
      // Use v.record(keyType, valueType) -> v.record(valueType) assuming string keys
      // For JSON schema, keys are always strings.
      schemaStr = `v.record(${additionalResult.schema})`;
      allImports.add('record');
      allImports.delete('object'); // v.object might have been added by default
    }
  } else {
    // Default behavior: additionalProperties is true or undefined (or not a boolean/object)
    // Allow any additional properties
    schemaStr = `v.object(${propsObject})`;
    // v.object is already in allImports by default.
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
