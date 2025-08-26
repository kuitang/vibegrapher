/**
 * CommitMessageModal Component - Phase 008: Human Review UI
 * Modal for editing and refining commit messages before committing
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { 
  GitCommit, 
  Sparkles, 
  Loader2, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { Diff } from '@/store/types'

interface CommitMessageModalProps {
  diff: Diff
  open: boolean
  onClose: () => void
  onCommit: (diffId: string, message: string) => Promise<void>
  onRefine: (diffId: string, currentMessage: string) => Promise<string>
}

export function CommitMessageModal({
  diff,
  open,
  onClose,
  onCommit,
  onRefine
}: CommitMessageModalProps) {
  const [commitMessage, setCommitMessage] = useState(diff.commit_message)
  const [isRefining, setIsRefining] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleRefine = async () => {
    setIsRefining(true)
    setError(null)
    
    try {
      const refinedMessage = await onRefine(diff.id, commitMessage)
      setCommitMessage(refinedMessage)
      toast({
        title: "Message Refined",
        description: "AI has improved your commit message",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refine message'
      setError(errorMessage)
      toast({
        title: "Refinement Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsRefining(false)
    }
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message cannot be empty')
      return
    }

    setIsCommitting(true)
    setError(null)
    
    try {
      await onCommit(diff.id, commitMessage)
      toast({
        title: "Changes Committed",
        description: "Your changes have been successfully committed",
      })
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to commit changes'
      
      // Handle specific error cases
      if (errorMessage.includes('rebase_needed')) {
        setError('Base commit has changed. Please regenerate the diff.')
        toast({
          title: "Rebase Required",
          description: "The base commit has changed. You'll need to regenerate the diff.",
          variant: "destructive",
        })
      } else {
        setError(errorMessage)
        toast({
          title: "Commit Failed",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setIsCommitting(false)
    }
  }

  // Calculate stats for the diff
  const getDiffStats = () => {
    const lines = diff.diff_content.split('\n')
    let additions = 0
    let deletions = 0
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++
      }
    }
    
    return { additions, deletions }
  }

  const { additions, deletions } = getDiffStats()

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Finalize Commit Message
          </DialogTitle>
          <DialogDescription>
            Review and edit the commit message before applying changes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Diff Summary */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Changes Summary</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600">
                    +{additions}
                  </Badge>
                  <Badge variant="outline" className="text-red-600">
                    -{deletions}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-3">
              <p className="text-sm text-muted-foreground">
                {diff.vibecoder_prompt}
              </p>
            </CardContent>
          </Card>

          {/* Commit Message Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Commit Message</label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefine}
                disabled={isRefining || isCommitting}
              >
                {isRefining ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Refining...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-2" />
                    Refine with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Enter your commit message..."
              className="min-h-[120px] font-mono text-sm"
              disabled={isRefining || isCommitting}
            />
            <p className="text-xs text-muted-foreground">
              Write a clear, concise message describing the changes
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isCommitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || isCommitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isCommitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Committing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Commit Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}