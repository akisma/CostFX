/**
 * Async Handler Middleware
 * 
 * Wraps async route handlers to catch errors and pass them to error middleware
 * Eliminates the need for try/catch blocks in every controller method
 */

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
