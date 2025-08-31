/**
 * useDiffRecovery Hook - Phase 008: Human Review UI
 * Recovers pending diff state after page refresh
 */

import { useEffect } from 'react'
import useAppStore from '@/store/useAppStore'

export function useDiffRecovery(projectId: string | undefined) {
  const actions = useAppStore((state) => state.actions)
  const hasHydrated = useAppStore((state) => state.hasHydrated)
  const currentReviewDiff = useAppStore((state) => state.currentReviewDiff)
  const showCommitMessageModal = useAppStore((state) => state.showCommitMessageModal)

  useEffect(() => {
    if (!projectId || !hasHydrated) return

    // Check for pending diffs on mount/refresh
    const checkPendingDiffs = async () => {
      // If we already have a diff in review, restore the modal state
      if (currentReviewDiff) {
        if (showCommitMessageModal) {
          // User was in commit message modal
          actions.setShowCommitMessageModal(true)
        } else {
          // User was in diff review modal
          actions.setShowDiffReviewModal(true)
        }
      } else {
        // Load any pending diffs from backend
        try {
          await actions.loadPendingDiffs(projectId)
        } catch (error) {
          console.error('[useDiffRecovery] Error loading pending diffs:', error)
        }
      }
    }

    checkPendingDiffs()
  }, [projectId, hasHydrated, actions, currentReviewDiff, showCommitMessageModal]) // Only run when project changes or after hydration

  // Also listen for diff events from WebSocket
  useEffect(() => {
    const handleDiffCreated = (event: CustomEvent) => {
      console.log('[useDiffRecovery] Diff created event:', event.detail)
      // Reload pending diffs when a new diff is created
      if (projectId) {
        actions.loadPendingDiffs(projectId)
      }
    }

    window.addEventListener('diff_created', handleDiffCreated as EventListener)
    
    return () => {
      window.removeEventListener('diff_created', handleDiffCreated as EventListener)
    }
  }, [projectId, actions])
}