import { vi, describe, it, expect, beforeEach } from 'vitest'

// Create a proper localStorage mock
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

// Mock axios interceptors
const mockRequestInterceptor = vi.fn()
const mockResponseInterceptor = vi.fn()

const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  defaults: {
    baseURL: 'http://localhost:3001/api/v1',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
  },
  interceptors: {
    request: { use: mockRequestInterceptor },
    response: { use: mockResponseInterceptor }
  }
}

const mockAxios = {
  create: vi.fn().mockReturnValue(mockAxiosInstance),
  defaults: {},
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  }
}

vi.mock('axios', () => ({
  default: mockAxios
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    localStorageMock.getItem.mockReturnValue(null)
    // Clear module cache to get fresh import
    vi.resetModules()
  })

  it('creates axios instance with correct config', async () => {
    // Import api after mocking axios
    await import('../../src/services/api')
    
    expect(mockAxios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:3001/api/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  })

  it('includes auth token in requests when available', async () => {
    // Setup localStorage mock to return a token
    localStorageMock.getItem.mockReturnValue('test-token')
    
    // Import API which will set up interceptors
    await import('../../src/services/api')
    
    // Verify request interceptor was set up
    expect(mockRequestInterceptor).toHaveBeenCalled()
    
    // Get the interceptor function and test it
    const requestInterceptor = mockRequestInterceptor.mock.calls[0][0]
    const config = { headers: {} }
    const result = requestInterceptor(config)
    
    expect(result.headers.Authorization).toBe('Bearer test-token')
  })

  it('handles requests without auth token', async () => {
    // Ensure localStorage returns null
    localStorageMock.getItem.mockReturnValue(null)
    
    // Import API
    await import('../../src/services/api')
    
    // Verify request interceptor was set up
    expect(mockRequestInterceptor).toHaveBeenCalled()
    
    // Get the interceptor function and test it
    const requestInterceptor = mockRequestInterceptor.mock.calls[0][0]
    const config = { headers: {} }
    const result = requestInterceptor(config)
    
    // Should not have Authorization header
    expect(result.headers.Authorization).toBeUndefined()
  })

  it('handles 401 responses by clearing token and redirecting', async () => {
    // Mock window.location
    delete window.location
    window.location = { href: '' }
    
    await import('../../src/services/api')
    
    // Verify response interceptor was set up
    expect(mockResponseInterceptor).toHaveBeenCalled()
    
    // Get the error handler from response interceptor
    const responseErrorHandler = mockResponseInterceptor.mock.calls[0][1]
    
    // Test 401 error handling
    const error = { response: { status: 401 } }
    
    try {
      await responseErrorHandler(error)
    } catch (e) {
      // Should reject with the error
      expect(e).toBe(error)
    }
    
    // Should clear token and redirect
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken')
    expect(window.location.href).toBe('/login')
  })

  it('passes through non-401 errors', async () => {
    await import('../../src/services/api')
    
    // Verify response interceptor was set up
    expect(mockResponseInterceptor).toHaveBeenCalled()
    
    // Get the error handler from response interceptor
    const responseErrorHandler = mockResponseInterceptor.mock.calls[0][1]
    
    // Test non-401 error handling
    const error = { response: { status: 500 } }
    
    try {
      await responseErrorHandler(error)
    } catch (e) {
      // Should reject with the error without clearing token
      expect(e).toBe(error)
    }
    
    // Should not call removeItem for non-401 errors
    expect(localStorageMock.removeItem).not.toHaveBeenCalled()
  })
})
