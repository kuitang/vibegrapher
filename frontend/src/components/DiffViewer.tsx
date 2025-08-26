/**
 * DiffViewer Component - Phase 007: Diff Handling
 * Monaco diff editor with Accept/Reject controls
 */

import { useState, useRef, useEffect } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CheckCircle2, XCircle, GitCompare, Info, FileCode } from 'lucide-react'
import type { editor } from 'monaco-editor'

interface DiffViewerProps {
  original: string
  proposed: string
  patch?: string
  sessionId: string
  diffId: string
  fileName?: string
  onAccept: (diffId: string) => void
  onReject: (diffId: string) => void
}

export function DiffViewer({
  original,
  proposed,
  patch,
  sessionId,
  diffId,
  fileName = 'main.py',
  onAccept,
  onReject
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)

  // Handle diff editor mount
  const handleEditorDidMount = (editor: editor.IStandaloneDiffEditor) => {
    diffEditorRef.current = editor
    
    // Configure diff editor options based on viewport
    const isMobileViewport = window.innerWidth <= 768
    editor.updateOptions({
      readOnly: true,
      renderSideBySide: viewMode === 'split' && !isMobileViewport,
      renderOverviewRuler: true,
      minimap: { enabled: false },
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

  // Update view mode when tabs change
  useEffect(() => {
    if (diffEditorRef.current) {
      diffEditorRef.current.updateOptions({
        renderSideBySide: viewMode === 'split'
      })
    }
  }, [viewMode])

  const handleAcceptClick = () => {
    setShowConfirmDialog(true)
  }

  const handleConfirmAccept = async () => {
    setIsProcessing(true)
    setShowConfirmDialog(false)
    
    try {
      await onAccept(diffId)
      console.log('[DiffViewer] Diff accepted:', diffId)
    } catch (error) {
      console.error('[DiffViewer] Error accepting diff:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    setIsProcessing(true)
    
    try {
      await onReject(diffId)
      console.log('[DiffViewer] Diff rejected:', diffId)
    } catch (error) {
      console.error('[DiffViewer] Error rejecting diff:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Get theme based on current app theme
  const getTheme = () => {
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? 'vs-dark' : 'vs-light'
  }

  // Calculate diff stats
  const getDiffStats = () => {
    const originalLines = original.split('\n').length
    const proposedLines = proposed.split('\n').length
    const additions = Math.max(0, proposedLines - originalLines)
    const deletions = Math.max(0, originalLines - proposedLines)
    
    return { additions, deletions }
  }

  const { additions, deletions } = getDiffStats()

  return (
    <>
      <Card className="h-full flex flex-col" data-testid="diff-card">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              <CardTitle>Diff Review</CardTitle>
              <Badge variant="outline" className="text-xs">
                <FileCode className="h-3 w-3 mr-1" />
                {fileName}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid="session-info"
                      className="h-8 w-8"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Session: {sessionId}</p>
                    <p className="text-xs">Diff ID: {diffId}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="flex items-center gap-1 text-sm">
                <span className="text-green-500">+{additions}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-red-500">-{deletions}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <Tabs 
            value={viewMode} 
            onValueChange={(value) => setViewMode(value as 'unified' | 'split')}
            className="flex-1 flex flex-col"
          >
            <div className="px-6 py-2 border-b">
              <TabsList className="grid w-[200px] grid-cols-2">
                <TabsTrigger value="unified">Unified</TabsTrigger>
                <TabsTrigger value="split">Split</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={viewMode} className="flex-1 m-0">
              <div 
                className="h-full w-full min-h-[300px] md:min-h-[400px]" 
                data-testid="monaco-diff"
                data-view={viewMode}
              >
                <DiffEditor
                  height="100%"
                  original={original}
                  modified={proposed}
                  language="python"
                  theme={getTheme()}
                  onMount={handleEditorDidMount}
                  options={{
                    readOnly: true,
                    renderSideBySide: viewMode === 'split',
                    renderOverviewRuler: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    fontLigatures: true
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end gap-2 p-4 border-t">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={isProcessing}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={handleAcceptClick}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply the proposed changes to your code. 
              The diff shows {additions} additions and {deletions} deletions.
              This action cannot be undone directly, but you can always reject future diffs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAccept}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}