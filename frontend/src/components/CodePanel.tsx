/**
 * CodePanel Component - Phase 007
 * Container that switches between CodeViewer and DiffViewer
 */

import { useState, useEffect, useCallback } from 'react'
import { CodeViewer } from './CodeViewer'
import { DiffViewer } from './DiffViewer'
import { useSocketIO } from '@/hooks/useSocketIO'
import useAppStore from '@/store/useAppStore'
import type { DiffCreatedEvent } from '@/services/socketio'
import type { Diff } from '@/store/types'

interface CodePanelProps {
  projectId: string
}

export function CodePanel({ projectId }: CodePanelProps) {
  const [currentDiff, setCurrentDiff] = useState<Diff | null>(null)
  const [originalCode, setOriginalCode] = useState<string>('')
  const [proposedCode, setProposedCode] = useState<string>('')
  
  const currentCode = useAppStore((state) => state.currentCode)
  const updateCode = useAppStore((state) => state.actions.updateCode)
  
  // Parse unified diff format - defined early so it can be used in callbacks
  const parseDiff = useCallback((diffContent: string) => {
    const lines = diffContent.split('\n')
    const original: string[] = []
    const proposed: string[] = []
    
    let inHunk = false
    
    for (const line of lines) {
      if (line.startsWith('@@')) {
        inHunk = true
        continue
      }
      
      if (!inHunk) continue
      
      if (line.startsWith('-')) {
        // Line removed in the proposed version
        original.push(line.substring(1))
      } else if (line.startsWith('+')) {
        // Line added in the proposed version
        proposed.push(line.substring(1))
      } else if (line.startsWith(' ')) {
        // Context line (same in both)
        original.push(line.substring(1))
        proposed.push(line.substring(1))
      } else if (!line.startsWith('\\')) {
        // Regular context line without prefix
        original.push(line)
        proposed.push(line)
      }
    }
    
    // If we couldn't parse the diff, use the current code as original
    // and assume the diff content is the proposed code
    if (original.length === 0 && proposed.length === 0) {
      return {
        original: currentCode || '# No current code',
        proposed: diffContent
      }
    }
    
    return {
      original: original.join('\n'),
      proposed: proposed.join('\n')
    }
  }, [currentCode])
  
  // TEST: Add test button to simulate diff
  useEffect(() => {
    // @ts-expect-error - Test code for development
    window.testDiff = () => {
      const testDiff: Diff = {
        id: 'test-diff-' + Date.now(),
        session_id: 'test-session-123',
        project_id: projectId,
        base_commit: 'abc123',
        target_branch: 'main',
        diff_content: `--- a/main.py
+++ b/main.py
@@ -1,10 +1,15 @@
 # Welcome to Vibegrapher
 # Project: abcd

 def main():
     """Main entry point for the application."""
     print("Ready for vibecoding!")
+    
+def calculate_sum(a, b):
+    """Calculate the sum of two numbers."""
+    return a + b
     
 if __name__ == "__main__":
-    main()
+    result = calculate_sum(5, 3)
+    print(f"Sum: {result}")
+    main()`,
        status: 'evaluator_approved',
        vibecoder_prompt: 'Add a calculate_sum function',
        evaluator_reasoning: 'Function correctly implements sum operation',
        commit_message: 'Add calculate_sum function',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      const parsedDiff = parseDiff(testDiff.diff_content)
      setOriginalCode(parsedDiff.original)
      setProposedCode(parsedDiff.proposed)
      setCurrentDiff(testDiff)
    }
    console.log('[CodePanel] Test diff function available: window.testDiff()')
  }, [parseDiff, projectId])

  // Memoize the diff created callback to prevent unnecessary reconnections
  const handleDiffCreated = useCallback(async (event: DiffCreatedEvent) => {
    console.log('[CodePanel] Diff created:', event)
    
    // Fetch diff details from backend
    try {
      const apiUrl = import.meta.env.VITE_API_URL
      const response = await fetch(`${apiUrl}/diffs/${event.diff_id}`)
      
      if (response.ok) {
        const diff = await response.json()
        
        // Parse the diff content to extract original and proposed code
        const parsedDiff = parseDiff(diff.diff_content)
        setOriginalCode(parsedDiff.original)
        setProposedCode(parsedDiff.proposed)
        setCurrentDiff(diff)
      }
    } catch (error) {
      console.error('[CodePanel] Error fetching diff:', error)
    }
  }, [parseDiff]) // Include parseDiff dependency

  // Listen for diff created events
  useSocketIO(projectId, {
    onDiffCreated: handleDiffCreated
  })

  const handleAcceptDiff = async (diffId: string) => {
    console.log('[CodePanel] Accepting diff:', diffId)
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL
      const response = await fetch(`${apiUrl}/diffs/${diffId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedback: 'Accepted via UI'
        })
      })
      
      if (response.ok) {
        // Update the code viewer with the new code
        updateCode(proposedCode)
        // Clear the diff
        setCurrentDiff(null)
        console.log('[CodePanel] Diff accepted successfully')
      }
    } catch (error) {
      console.error('[CodePanel] Error accepting diff:', error)
    }
  }

  const handleRejectDiff = async (diffId: string) => {
    console.log('[CodePanel] Rejecting diff:', diffId)
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL
      const response = await fetch(`${apiUrl}/diffs/${diffId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedback: 'Rejected via UI'
        })
      })
      
      if (response.ok) {
        // Clear the diff without updating code
        setCurrentDiff(null)
        console.log('[CodePanel] Diff rejected successfully')
      }
    } catch (error) {
      console.error('[CodePanel] Error rejecting diff:', error)
    }
  }


  // If there's a pending diff, show the DiffViewer
  if (currentDiff) {
    return (
      <DiffViewer
        original={originalCode}
        proposed={proposedCode}
        patch={currentDiff.diff_content}
        sessionId={currentDiff.session_id}
        diffId={currentDiff.id}
        fileName="main.py"
        onAccept={handleAcceptDiff}
        onReject={handleRejectDiff}
      />
    )
  }

  // Otherwise show the CodeViewer
  return <CodeViewer projectId={projectId} />
}