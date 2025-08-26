/**
 * CodeViewer Component - Phase 006: Code Display
 * Monaco editor with real-time WebSocket updates
 */

import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileCode, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSocketIO } from '@/hooks/useSocketIO'
import useAppStore from '@/store/useAppStore'
import type { editor } from 'monaco-editor'

interface CodeViewerProps {
  projectId: string
}

export function CodeViewer({ projectId }: CodeViewerProps) {
  const project = useAppStore((state) => state.project)
  const [code, setCode] = useState<string>('# Loading...')
  const [fileName, setFileName] = useState<string>('main.py')
  const [isLoading, setIsLoading] = useState(true)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<any>(null)

  // Socket.io connection for real-time updates
  const { isConnected } = useSocketIO(projectId, {
    onCodeUpdate: (data: { content: string; filename?: string }) => {
      console.log('[CodeViewer] Received code update:', data)
      setCode(data.content)
      if (data.filename) {
        setFileName(data.filename)
      }
    }
  })

  // Load initial code when component mounts
  useEffect(() => {
    const loadInitialCode = async () => {
      try {
        // Check if project has code in store
        const currentCode = useAppStore.getState().currentCode
        if (currentCode) {
          setCode(currentCode)
          setIsLoading(false)
        } else {
          // Default Python code
          setCode(`# Welcome to Vibegrapher
# Project: ${project?.name || 'Loading...'}

def main():
    """Main entry point for the application."""
    print("Ready for vibecoding!")
    
if __name__ == "__main__":
    main()
`)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[CodeViewer] Error loading code:', error)
        setCode('# Error loading code')
        setIsLoading(false)
      }
    }

    loadInitialCode()
  }, [project])

  // Handle editor mount
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco
    
    // Configure editor options
    editor.updateOptions({
      readOnly: true,
      minimap: { enabled: true },
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontLigatures: true
    })
  }

  // Handle manual refresh
  const handleRefresh = () => {
    setIsLoading(true)
    // Simulate refresh - in production, this would fetch latest from backend
    setTimeout(() => {
      setIsLoading(false)
    }, 500)
  }

  // Get theme based on current app theme
  const getTheme = () => {
    // Check if dark mode (simplified - you might have a proper theme context)
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? 'vs-dark' : 'vs-light'
  }

  return (
    <Card className="h-full flex flex-col" data-testid="code-viewer">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            <CardTitle>Code Viewer</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && (
              <Badge variant="outline" className="text-xs">
                Live Updates
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {fileName}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh code"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <div 
          className="h-full w-full" 
          data-testid="monaco-container"
          data-language="python"
          data-readonly="true"
        >
          <Editor
            height="100%"
            defaultLanguage="python"
            language="python"
            value={code}
            theme={getTheme()}
            onMount={handleEditorDidMount}
            loading={
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">Loading editor...</div>
              </div>
            }
            options={{
              readOnly: true,
              minimap: { enabled: true },
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}