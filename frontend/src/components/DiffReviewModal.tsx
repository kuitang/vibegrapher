/**
 * DiffReviewModal Component - Phase 008: Human Review UI
 * Modal for reviewing diffs with evaluator reasoning
 */

import { useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  CheckCircle2, 
  XCircle, 
  GitCompare, 
  Brain, 
  DollarSign,
  AlertCircle
} from 'lucide-react'
import type { Diff } from '@/store/types'

interface DiffReviewModalProps {
  diff: Diff
  open: boolean
  onClose: () => void
  onApprove: (diffId: string) => Promise<void>
  onReject: (diffId: string, reason: string) => Promise<void>
}

export function DiffReviewModal({
  diff,
  open,
  onClose,
  onApprove,
  onReject
}: DiffReviewModalProps) {
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectionForm, setShowRejectionForm] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Parse the diff to get original and modified code
  const parseDiff = (diffContent: string) => {
    const lines = diffContent.split('\n')
    const original: string[] = []
    const modified: string[] = []
    
    let inHunk = false
    
    for (const line of lines) {
      if (line.startsWith('@@')) {
        inHunk = true
        continue
      }
      
      if (!inHunk) continue
      
      if (line.startsWith('-')) {
        original.push(line.substring(1))
      } else if (line.startsWith('+')) {
        modified.push(line.substring(1))
      } else if (line.startsWith(' ')) {
        original.push(line.substring(1))
        modified.push(line.substring(1))
      }
    }
    
    return {
      original: original.join('\n') || '# No changes',
      modified: modified.join('\n') || '# No changes'
    }
  }

  const { original, modified } = parseDiff(diff.diff_content)

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await onApprove(diff.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) return
    
    setIsProcessing(true)
    try {
      await onReject(diff.id, rejectionReason)
      setRejectionReason('')
      setShowRejectionForm(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const getTheme = () => {
    return document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs-light'
  }

  // Calculate token usage if available
  const getTokenUsage = () => {
    // This would come from the diff or session data
    // For now, using placeholder
    return {
      prompt: 1234,
      completion: 567,
      total: 1801
    }
  }

  const tokenUsage = getTokenUsage()

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Diff Review
            <Badge variant={diff.status === 'evaluator_approved' ? 'default' : 'secondary'}>
              {diff.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review the changes proposed by VibeCoder and approved by the Evaluator
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Evaluator Reasoning Card */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Evaluator Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              <p className="text-sm">{diff.evaluator_reasoning}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Prompt: {tokenUsage.prompt} tokens
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Completion: {tokenUsage.completion} tokens
                </span>
                <span className="flex items-center gap-1 text-blue-500">
                  <DollarSign className="h-3 w-3" />
                  Total: {tokenUsage.total} tokens
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Commit Message */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Proposed Commit Message</CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              <p className="text-sm font-mono">{diff.commit_message}</p>
            </CardContent>
          </Card>

          {/* Diff Viewer */}
          <div className="flex-1 border rounded-lg overflow-hidden">
            <DiffEditor
              height="400px"
              original={original}
              modified={modified}
              language="python"
              theme={getTheme()}
              options={{
                readOnly: true,
                renderSideBySide: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13
              }}
            />
          </div>

          {/* Rejection Form */}
          {showRejectionForm && (
            <Card className="border-red-500/20">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Provide Rejection Feedback
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3">
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain what needs to be changed or improved..."
                  className="min-h-[100px]"
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Your feedback will be used to generate an improved solution
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <div className="flex w-full justify-between">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
            >
              Close
            </Button>
            
            <div className="flex gap-2">
              {showRejectionForm ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectionForm(false)
                      setRejectionReason('')
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRejectSubmit}
                    disabled={!rejectionReason.trim() || isProcessing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Submit Rejection
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectionForm(true)}
                    disabled={isProcessing}
                    className="text-red-600 hover:text-red-700"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Accept & Continue
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}