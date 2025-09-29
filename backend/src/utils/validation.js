/**
 * Validation Utilities
 * 
 * Simple validation helpers for API endpoints
 */

export const validateRequest = (schema, data) => {
  const { error, value } = schema.validate(data);
  if (error) {
    const validationError = new Error(`Validation error: ${error.details[0].message}`);
    validationError.statusCode = 400;
    throw validationError;
  }
  return value;
};

export const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export default {
  validateRequest,
  createValidationError
};
