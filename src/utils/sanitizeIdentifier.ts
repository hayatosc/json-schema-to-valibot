/**
 * Sanitizes a string to be a valid JavaScript identifier
 * @param name - The name to sanitize
 * @returns A valid JavaScript identifier
 */
export function sanitizeIdentifier(name: string): string {
  // Replace invalid characters with underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_$]/g, '_')
  
  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`
  }
  
  // Ensure it's not empty
  if (!sanitized) {
    sanitized = '_'
  }
  
  return sanitized
}