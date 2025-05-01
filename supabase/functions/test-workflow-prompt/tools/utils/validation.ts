
/**
 * Validation utilities for tools
 */

/**
 * Validates that required parameters are present
 */
export function validateRequiredParams(
  params: Record<string, any>,
  requiredParams: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const param of requiredParams) {
    if (params[param] === undefined || params[param] === null) {
      errors.push(`Missing required parameter: ${param}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates that a parameter is one of a set of allowed values
 */
export function validateEnum(
  value: string,
  allowedValues: string[],
  paramName: string
): { valid: boolean; errors: string[] } {
  if (!allowedValues.includes(value)) {
    return {
      valid: false,
      errors: [`Invalid value for ${paramName}: ${value}. Allowed values: ${allowedValues.join(', ')}`]
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Combines multiple validation results
 */
export function combineValidationResults(
  ...results: { valid: boolean; errors?: string[] }[]
): { valid: boolean; errors: string[] } {
  const allErrors: string[] = [];
  let valid = true;

  for (const result of results) {
    if (!result.valid) {
      valid = false;
      if (result.errors) {
        allErrors.push(...result.errors);
      }
    }
  }

  return {
    valid,
    errors: allErrors
  };
}
