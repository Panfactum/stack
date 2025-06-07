// Generic type guard utilities for runtime type validation

import { CLIError } from '@/util/error/error';

/**
 * Creates a type guard function that validates if a value is one of the allowed values
 * @param allowedValues - Array of allowed values to check against
 * @returns Type guard function that narrows the type
 */
export function createEnumTypeGuard<T extends readonly string[]>(
  allowedValues: T
) {
  return (value: string): value is T[number] => {
    return allowedValues.includes(value as T[number]);
  };
}

/**
 * Validates that a value is one of the allowed values and throws an error if not
 * @param value - Value to validate
 * @param allowedValues - Array of allowed values
 * @param errorMessage - Custom error message (optional)
 * @returns The validated value with narrowed type
 * @throws CLIError if validation fails
 */
export function validateEnum<T extends readonly string[]>(
  value: string,
  allowedValues: T,
  errorMessage?: string
): T[number] {
  const isValid = createEnumTypeGuard(allowedValues);
  
  if (!isValid(value)) {
    const defaultMessage = `Value must be one of: ${allowedValues.join(', ')}. Got: ${value}`;
    throw new CLIError(errorMessage || defaultMessage);
  }
  
  return value;
}