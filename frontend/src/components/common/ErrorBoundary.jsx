import { Component } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle } from 'lucide-react'

/**
 * ErrorBoundary Component
 * 
 * Purpose: Catch and handle React component errors gracefully
 * Issue: #30 - Square OAuth Connection UI (Phase 4)
 * 
 * Features:
 * - Catches errors in child components
 * - Displays user-friendly error message
 * - Provides error details for debugging
 * - Allows page refresh to recover
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // You can also log the error to an error reporting service here
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })

    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    const isDevelopment = import.meta.env.MODE === 'development'
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                Something went wrong
              </h2>
              
              <p className="text-gray-600 text-center mb-6">
                We encountered an unexpected error. Please try refreshing the page.
              </p>

              {isDevelopment && this.state.error && (
                <div className="mb-6 p-4 bg-red-50 rounded-lg">
                  <p className="text-sm font-semibold text-red-900 mb-2">Error Details:</p>
                  <p className="text-xs text-red-800 font-mono break-all">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-800 cursor-pointer">
                        Component Stack
                      </summary>
                      <pre className="mt-2 text-xs text-red-700 overflow-auto max-h-40">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refresh Page
                </button>
                
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.func,
  onError: PropTypes.func,
  onReset: PropTypes.func
}

export default ErrorBoundary
