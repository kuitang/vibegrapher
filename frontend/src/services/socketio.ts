/**
 * Socket.io Service - Phase 004
 * Real-time communication with backend for agent messages
 */

import { io, Socket } from 'socket.io-client'

// Socket.io event types
export interface ConversationMessageEvent {
  agent_type: 'vibecoder' | 'evaluator'
  iteration: number
  session_id: string
  timestamp: string
  content: any
}

export interface DiffCreatedEvent {
  diff_id: string
  commit_message: string
  session_id: string
  git_commit: string
}

export interface DebugIterationEvent {
  iteration: number
  patch_content: string
  patch_description: string
  evaluator_approved: boolean
  evaluator_reasoning: string
  evaluator_feedback: string
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

class SocketIOService {
  private socket: Socket | null = null
  private projectId: string | null = null
  private connectionState: ConnectionState = 'disconnected'
  private listeners: Map<string, Set<Function>> = new Map()

  constructor() {
    // Initialize socket connection will be done per project
  }

  /**
   * Connect to Socket.io server for a specific project
   */
  connect(projectId: string) {
    if (this.socket && this.projectId === projectId) {
      console.log('[Socket.io] Already connected to project:', projectId)
      return
    }

    // Disconnect from previous project if any
    if (this.socket) {
      this.disconnect()
    }

    this.projectId = projectId
    const apiUrl = import.meta.env.VITE_API_URL || 'http://kui-vibes:8000'
    
    console.log('[Socket.io] Connecting to:', apiUrl, 'for project:', projectId)
    
    this.socket = io(apiUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      query: {
        project_id: projectId
      }
    })

    this.setupEventHandlers()
    this.updateConnectionState('connecting')
  }

  /**
   * Setup Socket.io event handlers
   */
  private setupEventHandlers() {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      console.log('[Socket.io] Connected, joining project room:', this.projectId)
      this.updateConnectionState('connected')
      
      // Join project room
      if (this.projectId) {
        this.socket!.emit('join_project', { project_id: this.projectId })
      }
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket.io] Disconnected:', reason)
      this.updateConnectionState('disconnected')
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket.io] Reconnected after', attemptNumber, 'attempts')
      this.updateConnectionState('connected')
      
      // Rejoin project room
      if (this.projectId) {
        this.socket!.emit('join_project', { project_id: this.projectId })
      }
    })

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket.io] Reconnection attempt', attemptNumber)
      this.updateConnectionState('reconnecting')
    })

    // Business events
    this.socket.on('conversation_message', (data: ConversationMessageEvent) => {
      console.log('[Socket.io] Conversation message:', data, 'session_id:', data.session_id)
      this.emit('conversation_message', data)
    })

    this.socket.on('diff_created', (data: DiffCreatedEvent) => {
      console.log('[Socket.io] Diff created:', data, 'session_id:', data.session_id)
      this.emit('diff_created', data)
    })

    this.socket.on('debug_iteration', (data: DebugIterationEvent) => {
      console.log('[Socket.io] Debug iteration:', data)
      this.emit('debug_iteration', data)
    })
    
    // Code update event for Monaco editor
    this.socket.on('code_update', (data: { content: string; filename?: string }) => {
      console.log('[Socket.io] Code update:', data)
      this.emit('code_update', data)
    })

    // Error handling
    this.socket.on('error', (error) => {
      console.error('[Socket.io] Error:', error)
      this.emit('error', error)
    })

    this.socket.on('connect_error', (error) => {
      console.error('[Socket.io] Connection error:', error.message)
      this.updateConnectionState('reconnecting')
    })
  }

  /**
   * Disconnect from Socket.io server
   */
  disconnect() {
    if (this.socket) {
      console.log('[Socket.io] Disconnecting from project:', this.projectId)
      
      // Leave project room
      if (this.projectId) {
        this.socket.emit('leave_project', { project_id: this.projectId })
      }
      
      this.socket.disconnect()
      this.socket = null
      this.projectId = null
      this.updateConnectionState('disconnected')
    }
  }

  /**
   * Send a message to the server
   */
  send(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      console.log('[Socket.io] Sending:', event, data)
      this.socket.emit(event, data)
    } else {
      console.warn('[Socket.io] Cannot send, not connected:', event)
    }
  }

  /**
   * Subscribe to Socket.io events
   */
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  /**
   * Emit event to local listeners
   */
  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  /**
   * Update connection state
   */
  private updateConnectionState(state: ConnectionState) {
    this.connectionState = state
    this.emit('connection_state_change', state)
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false
  }
}

// Export singleton instance
export const socketIOService = new SocketIOService()
export default socketIOService