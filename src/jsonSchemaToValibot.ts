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
    definitionsOutput += `${defJsDoc}${exportKeyword} ${refData.schemaName} = ${result.schema};\n\n`
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