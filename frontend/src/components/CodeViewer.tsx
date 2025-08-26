/**
 * CodeViewer Component - Phase 006: Code Display
 * Monaco editor with real-time WebSocket updates
 */

import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { CardHeader, CardTitle } from '@/components/ui/card'
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
  const [isMobile, setIsMobile] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor')>(null)
  
  // Check if mobile on mount
  useEffect(() => {
    setIsMobile(window.innerWidth <= 768)
    
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
      // Trigger Monaco layout when window resizes
      if (editorRef.current) {
        editorRef.current.layout()
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Force Monaco to layout when component becomes visible or viewport changes
  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        // Force Monaco to recalculate its layout
        setTimeout(() => {
          editorRef.current?.layout()
        }, 100)
      }
    }
    
    // Listen for tab changes and resizes
    document.addEventListener('click', handleResize)
    window.addEventListener('resize', handleResize)
    
    // Initial layout
    handleResize()
    
    return () => {
      document.removeEventListener('click', handleResize)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

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
        } else if (project) {
          // Fetch current code from backend
          const apiUrl = import.meta.env.VITE_API_URL || 'http://kui-vibes:8000'
          try {
            const response = await fetch(`${apiUrl}/projects/${projectId}`)
            if (response.ok) {
              const projectData = await response.json()
              if (projectData.current_code) {
                setCode(projectData.current_code)
                useAppStore.getState().actions.updateCode(projectData.current_code, 'main.py')
              } else {
                setCode('# No code available')
              }
            } else {
              setCode('# Failed to load code from server')
            }
          } catch (fetchError) {
            console.error('[CodeViewer] Failed to fetch code from backend:', fetchError)
            setCode('# Failed to load code')
          }
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[CodeViewer] Error loading code:', error)
        setCode('# Error loading code')
        setIsLoading(false)
      }
    }

    loadInitialCode()
  }, [project, projectId])

  // Handle editor mount
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor
    monacoRef.current = monaco
    
    // Configure editor options based on viewport
    const isMobileViewport = window.innerWidth <= 768
    editor.updateOptions({
      readOnly: true,
      minimap: { enabled: !isMobileViewport },
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontSize: isMobileViewport ? 12 : 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontLigatures: true,
      wordWrap: isMobileViewport ? 'on' : 'off',
      wrappingIndent: 'same'
    })
    
    // Force layout update to ensure proper height
    setTimeout(() => {
      editor.layout()
    }, 100)
  }

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://kui-vibes:8000'
      const response = await fetch(`${apiUrl}/projects/${projectId}`)
      if (response.ok) {
        const projectData = await response.json()
        if (projectData.current_code) {
          setCode(projectData.current_code)
          useAppStore.getState().actions.updateCode(projectData.current_code, 'main.py')
          console.log('[CodeViewer] Code refreshed from backend')
        }
      } else {
        console.error('[CodeViewer] Failed to refresh code:', response.status)
      }
    } catch (error) {
      console.error('[CodeViewer] Error refreshing code:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Get theme based on current app theme
  const getTheme = () => {
    // Check if dark mode (simplified - you might have a proper theme context)
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? 'vs-dark' : 'vs-light'
  }

  return (
    <div className="h-full flex flex-col bg-card" data-testid="code-viewer">
      <CardHeader className="flex-shrink-0 border-b">
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

      <div className="flex-1 p-0 overflow-hidden min-h-0" data-testid="monaco-container">
          <Editor
            height="100%"
            defaultLanguage="python"
            language="python"
            value={code}
            theme={getTheme()}
            onMount={handleEditorDidMount}
            loading={
              <div className="flex items-center justify-center h-full min-h-[300px]">
                <div className="text-muted-foreground">Loading editor...</div>
              </div>
            }
            options={{
              readOnly: true,
              minimap: { enabled: !isMobile },
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontSize: isMobile ? 12 : 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true,
              wordWrap: isMobile ? 'on' : 'off'
            }}
          />
      </div>
    </div>
  )
}