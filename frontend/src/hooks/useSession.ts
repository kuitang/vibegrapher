/**
 * Session Hook - Phase 005
 * React hook for session management
 */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  startSession, 
  sendMessage, 
  clearSession, 
  getSessionMessages,
  getPendingDiffs
} from '@/services/sessions'
import useAppStore, { useAppActions } from '@/store/useAppStore'
import type { VibecodeSession, ConversationMessage, Diff } from '@/store/types'

export function useSession(projectId: string | undefined) {
  const queryClient = useQueryClient()
  const actions = useAppActions()
  const currentSession = useAppStore((state) => state.currentSession)
  const messages = useAppStore((state) => state.messages)
  const pendingDiffIds = useAppStore((state) => state.pendingDiffIds)
  
  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: (projectId: string) => startSession(projectId),
    onSuccess: (session) => {
      actions.setCurrentSession(session)
      queryClient.invalidateQueries({ queryKey: ['session', session.id] })
    }
  })
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) => 
      sendMessage(sessionId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', variables.sessionId, 'messages'] })
    }
  })
  
  // Clear session mutation
  const clearSessionMutation = useMutation({
    mutationFn: (sessionId: string) => clearSession(sessionId),
    onSuccess: () => {
      actions.setCurrentSession(null)
      actions.setMessages([])
      actions.setPendingDiffIds([])
      queryClient.invalidateQueries({ queryKey: ['session'] })
    }
  })
  
  // Get session messages
  const { data: fetchedMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['session', currentSession?.id, 'messages'],
    queryFn: () => currentSession ? getSessionMessages(currentSession.id) : Promise.resolve([]),
    enabled: !!currentSession,
    staleTime: 0 // Always fetch fresh data
  })
  
  // Get pending diffs
  const { data: pendingDiffs, isLoading: diffsLoading } = useQuery({
    queryKey: ['session', currentSession?.id, 'pendingDiffs'],
    queryFn: () => currentSession ? getPendingDiffs(currentSession.id) : Promise.resolve([]),
    enabled: !!currentSession,
    staleTime: 0 // Always fetch fresh data
  })
  
  // Sync fetched messages with store
  // We use fetched messages to initialize the store, but use the store for real-time updates
  // from Socket.io
  if (fetchedMessages && fetchedMessages.length > 0 && messages.length === 0) {
    actions.setMessages(fetchedMessages)
  }
  
  // Sync pending diffs with store
  if (pendingDiffs && pendingDiffs.length > 0 && pendingDiffIds.length === 0) {
    actions.setPendingDiffIds(pendingDiffs.map(diff => diff.id))
  }
  
  // Start a new session
  const start = useCallback(() => {
    if (!projectId) return
    startSessionMutation.mutate(projectId)
  }, [projectId, startSessionMutation])
  
  // Send a message
  const send = useCallback((content: string) => {
    if (!currentSession) return
    sendMessageMutation.mutate({ sessionId: currentSession.id, content })
  }, [currentSession, sendMessageMutation])
  
  // Clear the session
  const clear = useCallback(() => {
    if (!currentSession) return
    clearSessionMutation.mutate(currentSession.id)
  }, [currentSession, clearSessionMutation])
  
  return {
    // State
    session: currentSession,
    messages,
    pendingDiffIds,
    isStarting: startSessionMutation.isPending,
    isSending: sendMessageMutation.isPending,
    isClearing: clearSessionMutation.isPending,
    messagesLoading,
    diffsLoading,
    
    // Actions
    start,
    send,
    clear,
    
    // Errors
    startError: startSessionMutation.error,
    sendError: sendMessageMutation.error,
    clearError: clearSessionMutation.error
  }
}