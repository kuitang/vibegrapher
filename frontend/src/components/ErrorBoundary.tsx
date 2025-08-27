import React, { Component, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Update state with error details
    this.setState({
      error,
      errorInfo
    })
    
    // In development, show full stack trace
    if (import.meta.env.DEV) {
      console.error('Component Stack:', errorInfo.componentStack)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>
      }

      // Default error UI using Card instead of Alert
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred while rendering this component.
              </p>
              
              {/* Show error details in development */}
              {import.meta.env.DEV && this.state.error && (
                <div className="space-y-2">
                  <div className="rounded-md bg-red-50 dark:bg-red-950 p-4">
                    <h4 className="font-mono text-sm font-semibold text-red-800 dark:text-red-200">
                      {this.state.error.name}: {this.state.error.message}
                    </h4>
                    {this.state.error.stack && (
                      <pre className="mt-2 text-xs text-red-700 dark:text-red-300 overflow-auto">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                  
                  {this.state.errorInfo?.componentStack && (
                    <div className="rounded-md bg-gray-50 dark:bg-gray-950 p-4">
                      <h4 className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Component Stack:
                      </h4>
                      <pre className="mt-2 text-xs text-gray-700 dark:text-gray-300 overflow-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button onClick={this.handleReset} size="sm">
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                >
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for using error boundary programmatically
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return setError
}