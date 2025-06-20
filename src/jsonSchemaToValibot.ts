import { type JsonSchema, type ConversionOptions, type ParserContext } from './types'
import { parseSchema } from './parsers/parseSchema'

function sanitizeIdentifier(name: string): string {
  // Replace invalid JavaScript identifier characters with underscores
  // Valid identifiers can only contain letters, digits, underscore, and dollar sign
  // and cannot start with a digit
  return name
    .replace(/[^a-zA-Z0-9_$]/g, '_')  // Replace invalid chars with underscore
    .replace(/^[0-9]/, '_$&')         // Prefix with underscore if starts with digit
}

function generateTypeScriptType(schema: JsonSchema, typeName: string, context: ParserContext): string {
  if (typeof schema === 'boolean') {
    return schema ? 'any' : 'never';
  }

  if (schema.$ref) {
    const refKey = schema.$ref;
    const refData = context.refs.get(refKey);
    if (refData) {
      return refData.schemaName;
    }
    return 'any';
  }

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      if (schema.items) {
        if (Array.isArray(schema.items)) {
          // Tuple type
          const itemTypes = schema.items.map((item, i) => generateTypeScriptType(item, `${typeName}Item${i}`, context));
          return `[${itemTypes.join(', ')}]`;
        } else {
          const itemType = generateTypeScriptType(schema.items, `${typeName}Item`, context);
          return `${itemType}[]`;
        }
      }
      return 'any[]';
    case 'object':
      if (schema.properties) {
        const required = schema.required || [];
        const props = Object.entries(schema.properties).map(([key, propSchema]) => {
          const propType = generateTypeScriptType(propSchema, `${typeName}${key.charAt(0).toUpperCase() + key.slice(1)}`, context);
          const isRequired = required.includes(key);
          const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
          return `${keyStr}${isRequired ? '' : '?'}: ${propType}`;
        });
        
        let typeBody = `{ ${props.join('; ')} }`;
        
        // Handle additionalProperties
        if (schema.additionalProperties === true) {
          typeBody = `{ ${props.join('; ')}; [key: string]: any }`;
        } else if (typeof schema.additionalProperties === 'object') {
          const additionalType = generateTypeScriptType(schema.additionalProperties, `${typeName}Additional`, context);
          typeBody = `{ ${props.join('; ')}; [key: string]: ${additionalType} }`;
        }
        
        return typeBody;
      }
      return 'Record<string, any>';
    default:
      if (schema.anyOf) {
        const types = schema.anyOf.map((s, i) => generateTypeScriptType(s, `${typeName}Option${i}`, context));
        return types.join(' | ');
      }
      if (schema.oneOf) {
        const types = schema.oneOf.map((s, i) => generateTypeScriptType(s, `${typeName}Option${i}`, context));
        return types.join(' | ');
      }
      if (schema.allOf) {
        const types = schema.allOf.map((s, i) => generateTypeScriptType(s, `${typeName}Variant${i}`, context));
        return types.join(' & ');
      }
      return 'any';
  }
}

export function jsonSchemaToValibot(
  schema: JsonSchema,
  options: ConversionOptions = {}
): string {
  const {
    name = 'schema',
    module = 'esm',
    withTypes = false,
    withJsDoc = false,
    maxDepth = 10,
    exportDefinitions = true
  } = options

  const context: ParserContext = {
    refs: new Map(),
    depth: 0,
    maxDepth,
    currentPath: []
  }

  // Scan definitions
  if (typeof schema === 'object') {
    const processDefinitions = (definitions: Record<string, JsonSchema> | undefined, pathPrefix: string) => {
      if (definitions) {
        for (const key in definitions) {
          const defSchema = definitions[key]
          // Ensure defSchema is an object, as boolean schemas cannot be definitions
          if (typeof defSchema === 'object') {
            const schemaName = sanitizeIdentifier(key) // Sanitize the key to make it a valid JavaScript identifier
            context.refs.set(`${pathPrefix}${key}`, { schemaName, rawSchema: defSchema })
          }
        }
      }
    }
    processDefinitions(schema.definitions, '#/definitions/')
    processDefinitions(schema.$defs, '#/$defs/')
  }

  // Pre-scan for circular dependencies to determine which schemas are recursive
  const detectCircularDependencies = (schemaToCheck: JsonSchema, refKey: string, visited: Set<string>, processing: Set<string>): boolean => {
    if (processing.has(refKey)) {
      return true; // Found circular dependency
    }
    if (visited.has(refKey)) {
      return false; // Already checked, no circular dependency from this path
    }

    visited.add(refKey);
    processing.add(refKey);

    if (typeof schemaToCheck === 'object' && schemaToCheck !== null) {
      // Check for $ref properties recursively
      const checkForRefs = (obj: any): boolean => {
        if (typeof obj === 'object' && obj !== null) {
          if (obj.$ref && typeof obj.$ref === 'string') {
            if (processing.has(obj.$ref)) {
              return true; // Circular dependency found
            }
            const refData = context.refs.get(obj.$ref);
            if (refData) {
              if (detectCircularDependencies(refData.rawSchema, obj.$ref, visited, processing)) {
                return true;
              }
            }
          }
          // Recursively check all properties
          for (const value of Object.values(obj)) {
            if (checkForRefs(value)) {
              return true;
            }
          }
        }
        return false;
      };

      const isCircular = checkForRefs(schemaToCheck);
      processing.delete(refKey);
      return isCircular;
    }

    processing.delete(refKey);
    return false;
  };

  // Mark recursive schemas
  for (const [refKey, refData] of context.refs) {
    const isRecursive = detectCircularDependencies(refData.rawSchema, refKey, new Set(), new Set());
    if (isRecursive) {
      refData.isRecursive = true;
    }
  }

  const mainSchemaResult = parseSchema(schema, context)
  const allImports = new Set<string>(mainSchemaResult.imports)

  let definitionsOutput = ''
  const processedRefs = new Set<string>()

  // Iteratively parse definitions to handle potential nested refs within definitions
  // This is a simplified approach; a more robust solution might need to handle circular dependencies more explicitly
  // by marking schemas as "processing" and resolving them in multiple passes if necessary.
  for (const [refKey, refData] of context.refs) {
    if (refData.generatedCode) continue; // Already processed

    // Basic circular dependency check
    if (refData.isProcessing) {
      console.warn(`Circular dependency detected for ${refKey}, using v.any() as fallback.`)
      refData.generatedCode = 'v.any()' // Fallback for circular refs
      refData.generatedImports = new Set(['v'])
      refData.isProcessing = false;
      continue;
    }
    refData.isProcessing = true;

    const definitionContext: ParserContext = { ...context, currentPath: [...context.currentPath, refKey] }
    const result = parseSchema(refData.rawSchema, definitionContext)

    refData.generatedCode = result.schema
    refData.generatedImports = result.imports
    refData.isProcessing = false;

    result.imports.forEach(imp => allImports.add(imp))

    // Add JSDoc for the definition if available
    let defJsDoc = '';
    if (withJsDoc && typeof refData.rawSchema === 'object' && refData.rawSchema.description) {
      defJsDoc = `/**\n * ${refData.rawSchema.description}\n */\n`;
    }
    const exportKeyword = exportDefinitions ? 'export const' : 'const';
    
    // Add type annotation for recursive schemas
    if (refData.isRecursive) {
      // Generate TypeScript type definition for recursive schemas
      const tsType = generateTypeScriptType(refData.rawSchema, refData.schemaName, context);
      const exportTypeKeyword = exportDefinitions ? 'export type' : 'type';
      definitionsOutput += `${exportTypeKeyword} ${refData.schemaName} = ${tsType};\n\n`;
      
      // For recursive schemas, we need explicit type annotation
      definitionsOutput += `${defJsDoc}${exportKeyword} ${refData.schemaName}Schema: v.GenericSchema<${refData.schemaName}> = ${result.schema};\n\n`
    } else {
      definitionsOutput += `${defJsDoc}${exportKeyword} ${refData.schemaName} = ${result.schema};\n\n`
    }
    processedRefs.add(refKey)
  }
  
  let output = ''
  
  // Add imports
  if (module !== 'none' && allImports.size > 0) {
    // Assuming all imports come from 'valibot' for now
    // A more sophisticated import management might be needed if other libraries are used
    const valibotImports = Array.from(allImports).filter(imp => imp.startsWith('v.') || imp === 'v').map(imp => imp === 'v' ? 'v' : imp.substring(2));
    // Remove duplicates and ensure 'v' itself is not listed if specific functions are imported
    const uniqueValibotImports = [...new Set(valibotImports)];

    let importStringContent = '* as v';
    const specificImports = uniqueValibotImports.filter(imp => imp !== 'v');
    if (uniqueValibotImports.length > 0 && !uniqueValibotImports.includes('v')) {
      // This logic might need adjustment based on how parseSchema returns imports.
      // If parseSchema returns "v.object" etc., then we need to extract "object".
      // For now, let's assume it returns specific function names if not the whole 'v'.
      // This part needs to be robust.
      // A simple approach: if 'v' is in allImports, use '* as v'. Otherwise, list them.
      // However, current parseSchema tends to add 'v.object', 'v.string' etc.
      // Let's refine this:
      if (specificImports.length > 0 && !allImports.has('v')) {
         importStringContent = `{ ${specificImports.join(', ')} }`;
      }
    }


    const importStatement = module === 'esm' 
      ? `import ${importStringContent} from 'valibot'`
      : `const ${importStringContent === '* as v' ? 'v' : `{ ${specificImports.join(', ')} }`} = require('valibot')` // CJS might need adjustment for named imports
    output += `${importStatement}\n\n`
  }

  // Add definitions
  output += definitionsOutput

  // Add JSDoc if requested for the main schema
  if (withJsDoc && typeof schema === 'object' && schema.description) {
    output += `/**\n * ${schema.description}\n */\n`
  }
  
  // Add the schema definition
  const exportStatement = module === 'esm' ? 'export ' : ''
  output += `${exportStatement}const ${name} = ${mainSchemaResult.schema}\n`
  
  // Add TypeScript type if requested
  if (withTypes && mainSchemaResult.types) {
    output += `\n${exportStatement}type ${name}Type = ${mainSchemaResult.types}\n`
  }
  
  // Add default export for CJS
  if (module === 'cjs') {
    output += `\nmodule.exports = { ${name}${withTypes ? `, ${name}Type` : ''} }\n`
  }
  
  return output
}