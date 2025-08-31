/**
 * Socket.io Hook - Phase 004
 * React hook for using Socket.io connection
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import socketIOService from '@/services/socketio'
import type { 
  ConnectionState, 
  ConversationMessageEvent,
  DiffCreatedEvent,
  DebugIterationEvent 
} from '@/services/socketio'

interface UseSocketIOOptions {
  onConversationMessage?: (message: ConversationMessageEvent) => void
  onDiffCreated?: (diff: DiffCreatedEvent) => void
  onDebugIteration?: (debug: DebugIterationEvent) => void
  onCodeUpdate?: (data: { content: string; filename?: string }) => void
  onError?: (error: unknown) => void
}

export function useSocketIO(projectId: string | undefined, options: UseSocketIOOptions = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [isConnected, setIsConnected] = useState(false)
  
  // Store callbacks in refs to avoid reconnections when they change
  const callbacksRef = useRef(options)
  callbacksRef.current = options

  useEffect(() => {
    if (!projectId) {
      console.log('[useSocketIO] No project ID, skipping connection')
      return
    }

    console.log('[useSocketIO] Connecting to project:', projectId)
    
    // Connect to Socket.io server
    socketIOService.connect(projectId)

    // Setup event listeners
    const unsubscribers: ((...args: unknown[]) => void)[] = []

    // Connection state listener
    unsubscribers.push(
      socketIOService.on('connection_state_change', (state: ConnectionState) => {
        console.log('[useSocketIO] Connection state changed:', state)
        setConnectionState(state)
        setIsConnected(state === 'connected')
      })
    )

    // Business event listeners - use refs to get latest callbacks without reconnecting
    unsubscribers.push(
      socketIOService.on('conversation_message', (data: ConversationMessageEvent) => {
        if (callbacksRef.current.onConversationMessage) {
          callbacksRef.current.onConversationMessage(data)
        }
      })
    )

    unsubscribers.push(
      socketIOService.on('diff_created', (data: DiffCreatedEvent) => {
        if (callbacksRef.current.onDiffCreated) {
          callbacksRef.current.onDiffCreated(data)
        }
      })
    )

    unsubscribers.push(
      socketIOService.on('debug_iteration', (data: DebugIterationEvent) => {
        if (callbacksRef.current.onDebugIteration) {
          callbacksRef.current.onDebugIteration(data)
        }
      })
    )

    unsubscribers.push(
      socketIOService.on('code_update', (data: { content: string; filename?: string }) => {
        if (callbacksRef.current.onCodeUpdate) {
          callbacksRef.current.onCodeUpdate(data)
        }
      })
    )

    unsubscribers.push(
      socketIOService.on('error', (error: unknown) => {
        if (callbacksRef.current.onError) {
          callbacksRef.current.onError(error)
        }
      })
    )

    // Update initial state
    setConnectionState(socketIOService.getConnectionState())
    setIsConnected(socketIOService.isConnected())

    // Cleanup function
    return () => {
      console.log('[useSocketIO] Cleaning up Socket.io connection')
      
      // Unsubscribe all listeners
      unsubscribers.forEach(unsubscribe => unsubscribe())
      
      // Disconnect socket
      socketIOService.disconnect()
    }
  }, [projectId]) // Only reconnect when projectId changes

  // Send message function
  const sendMessage = useCallback((event: string, data: unknown) => {
    socketIOService.send(event, data)
  }, [])

  return {
    connectionState,
    isConnected,
    sendMessage
  }
}