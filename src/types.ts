export interface JsonSchemaObject {
  $schema?: string
  $id?: string
  $ref?: string
  $defs?: Record<string, JsonSchema>
  definitions?: Record<string, JsonSchema>
  
  // Type
  type?: JsonSchemaType | JsonSchemaType[]
  
  // String
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: string
  
  // Number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number | boolean
  exclusiveMaximum?: number | boolean
  multipleOf?: number
  
  // Array
  items?: JsonSchema | JsonSchema[]
  additionalItems?: JsonSchema | boolean
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  
  // Object
  properties?: Record<string, JsonSchema>
  additionalProperties?: JsonSchema | boolean
  required?: string[]
  minProperties?: number
  maxProperties?: number
  patternProperties?: Record<string, JsonSchema>
  propertyNames?: JsonSchema
  
  // Conditional
  if?: JsonSchema
  then?: JsonSchema
  else?: JsonSchema
  
  // Composition
  allOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  oneOf?: JsonSchema[]
  not?: JsonSchema
  
  // Generic
  title?: string
  description?: string
  default?: any
  examples?: any[]
  const?: any
  enum?: any[]
  
  // Nullable
  nullable?: boolean
}

export type JsonSchema = JsonSchemaObject | boolean

export type JsonSchemaType = 
  | 'null'
  | 'boolean'
  | 'object'
  | 'array'
  | 'number'
  | 'integer'
  | 'string'

export interface ConversionOptions {
  name?: string
  module?: 'esm' | 'cjs' | 'none'
  withTypes?: boolean
  withJsDoc?: boolean
  maxDepth?: number
}

export interface ParserContext {
  refs: Map<string, JsonSchema>
  depth: number
  maxDepth: number
  currentPath: string[]
}

export interface ParseResult {
  schema: string
  imports: Set<string>
  types?: string | undefined
}