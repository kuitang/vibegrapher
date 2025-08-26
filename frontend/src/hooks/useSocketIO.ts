/**
 * Socket.io Hook - Phase 004
 * React hook for using Socket.io connection
 */

import { useEffect, useState, useCallback } from 'react'
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
  onError?: (error: any) => void
}

export function useSocketIO(projectId: string | undefined, options: UseSocketIOOptions = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!projectId) {
      console.log('[useSocketIO] No project ID, skipping connection')
      return
    }

    console.log('[useSocketIO] Connecting to project:', projectId)
    
    // Connect to Socket.io server
    socketIOService.connect(projectId)

    // Setup event listeners
    const unsubscribers: Function[] = []

    // Connection state listener
    unsubscribers.push(
      socketIOService.on('connection_state_change', (state: ConnectionState) => {
        console.log('[useSocketIO] Connection state changed:', state)
        setConnectionState(state)
        setIsConnected(state === 'connected')
      })
    )

    // Business event listeners
    if (options.onConversationMessage) {
      unsubscribers.push(
        socketIOService.on('conversation_message', options.onConversationMessage)
      )
    }

    if (options.onDiffCreated) {
      unsubscribers.push(
        socketIOService.on('diff_created', options.onDiffCreated)
      )
    }

    if (options.onDebugIteration) {
      unsubscribers.push(
        socketIOService.on('debug_iteration', options.onDebugIteration)
      )
    }

    if (options.onError) {
      unsubscribers.push(
        socketIOService.on('error', options.onError)
      )
    }

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
  }, [projectId]) // Only reconnect if projectId changes

  // Send message function
  const sendMessage = useCallback((event: string, data: any) => {
    socketIOService.send(event, data)
  }, [])

  return {
    connectionState,
    isConnected,
    sendMessage
  }
}