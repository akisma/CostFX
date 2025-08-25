import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('Error Handler Middleware Unit Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should handle generic errors', () => {
    const error = new Error('Test error');
    
    errorHandler(error, mockReq, mockRes, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Test error'
    });
  });

  test('should handle errors with status codes', () => {
    const error = new Error('Validation error');
    error.status = 400;
    
    errorHandler(error, mockReq, mockRes, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Bad Request',
      message: 'Validation error'
    });
  });

  test('should handle Sequelize validation errors', () => {
    const error = {
      name: 'SequelizeValidationError',
      errors: [
        { path: 'email', message: 'Invalid email format' },
        { path: 'name', message: 'Name is required' }
      ]
    };
    
    errorHandler(error, mockReq, mockRes, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      details: {
        email: 'Invalid email format',
        name: 'Name is required'
      }
    });
  });

  test('should not expose stack traces in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    const error = new Error('Test error');
    error.stack = 'Test stack trace';
    
    errorHandler(error, mockReq, mockRes, mockNext);
    
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Something went wrong'
    });
    
    process.env.NODE_ENV = originalEnv;
  });

  test('should include stack traces in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const error = new Error('Test error');
    error.stack = 'Test stack trace';
    
    errorHandler(error, mockReq, mockRes, mockNext);
    
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Test error',
      stack: 'Test stack trace'
    });
    
    process.env.NODE_ENV = originalEnv;
  });
});
