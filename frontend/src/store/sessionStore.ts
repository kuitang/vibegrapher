/**
 * Session Store - Phase 005
 * Manages vibecode session state and message history
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  // Core fields
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string | Record<string, unknown>
  
  // Streaming fields (Phase 2)
  message_type?: string
  stream_event_type?: string | null
  stream_sequence?: number | null
  event_data?: Record<string, unknown> | null
  
  // Tool tracking
  tool_calls?: Array<Record<string, unknown>> | null
  tool_outputs?: Array<Record<string, unknown>> | null
  handoffs?: Array<Record<string, unknown>> | null
  
  // Token usage (typed)
  usage_input_tokens?: number | null
  usage_output_tokens?: number | null
  usage_total_tokens?: number | null
  usage_cached_tokens?: number | null
  usage_reasoning_tokens?: number | null
  
  // Legacy fields
  agent_type?: string
  iteration?: number
  session_id?: string
  timestamp: string
  token_usage?: Record<string, unknown>
}

export interface Session {
  id: string
  project_id: string
  type: 'global' | 'vibecode'
  created_at: string
  updated_at: string
}

interface SessionStore {
  session: Session | null
  messages: Message[]
  isLoading: boolean
  error: string | null
  
  // Actions
  createSession: (projectId: string) => Promise<void>
  sendMessage: (sessionId: string, prompt: string) => Promise<void>
  addMessage: (message: Message) => void
  clearSession: () => void
  restoreSession: (projectId: string) => Promise<void>
  setSession: (session: Session | null) => void
  setMessages: (messages: Message[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

const API_URL = import.meta.env.VITE_API_URL

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      session: null,
      messages: [],
      isLoading: false,
      error: null,

      createSession: async (projectId: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`${API_URL}/projects/${projectId}/sessions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: 'vibecode' })
          })

          if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`)
          }

          const session = await response.json()
          console.log('[SessionStore] Session created:', session)
          
          set({ 
            session,
            messages: [],
            isLoading: false
          })
        } catch (error) {
          console.error('[SessionStore] Error creating session:', error)
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create session',
            isLoading: false
          })
          throw error
        }
      },

      sendMessage: async (sessionId: string, prompt: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`${API_URL}/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
          })

          if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`)
          }

          const result = await response.json()
          console.log('[SessionStore] Message sent, response:', result)
          
          // Check if there was an error in the response
          if (result.error) {
            throw new Error(result.error)
          }

          // Add the assistant's response to messages
          if (result.content) {
            get().addMessage({
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: result.content,
              session_id: result.session_id,
              timestamp: new Date().toISOString(),
              token_usage: result.token_usage
            })
          }

          set({ isLoading: false })
        } catch (error) {
          console.error('[SessionStore] Error sending message:', error)
          set({ 
            error: error instanceof Error ? error.message : 'Failed to send message',
            isLoading: false
          })
          throw error
        }
      },

      addMessage: (message: Message) => {
        set((state) => ({
          messages: [...state.messages, message]
        }))
      },

      clearSession: () => {
        set({
          session: null,
          messages: [],
          error: null
        })
      },

      restoreSession: async (projectId: string) => {
        const state = get()
        
        // If we already have a session for this project, keep it
        if (state.session && state.session.project_id === projectId) {
          console.log('[SessionStore] Session already loaded for project:', projectId)
          return
        }

        // Clear state and try to fetch existing session
        set({
          session: null,
          messages: [],
          error: null,
          isLoading: true
        })
        
        try {
          // Create session (will return existing if available)
          const sessionResponse = await fetch(`${API_URL}/projects/${projectId}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
          
          if (sessionResponse.ok) {
            const session = await sessionResponse.json()
            console.log('[SessionStore] Restored session:', session)
            
            // Fetch existing messages for this session
            const messagesResponse = await fetch(`${API_URL}/sessions/${session.id}/messages`)
            if (messagesResponse.ok) {
              const apiMessages = await messagesResponse.json()
              console.log(`[SessionStore] Loaded ${apiMessages.length} existing messages`)
              
              // Convert API messages to frontend format
              const messages = apiMessages.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content || '',
                message_type: msg.message_type,
                stream_event_type: msg.stream_event_type,
                stream_sequence: msg.stream_sequence,
                event_data: msg.event_data,
                tool_calls: msg.tool_calls,
                tool_outputs: msg.tool_outputs,
                handoffs: msg.handoffs,
                usage_input_tokens: msg.usage_input_tokens,
                usage_output_tokens: msg.usage_output_tokens,
                usage_total_tokens: msg.usage_total_tokens,
                usage_cached_tokens: msg.usage_cached_tokens,
                usage_reasoning_tokens: msg.usage_reasoning_tokens,
                agent_type: msg.agent_type || 'unknown',
                iteration: msg.iteration,
                session_id: msg.session_id,
                timestamp: msg.created_at,
                token_usage: msg.token_usage
              }))
              
              set({ 
                session,
                messages,
                isLoading: false
              })
            } else {
              console.log('[SessionStore] Failed to load messages, starting with empty state')
              set({ 
                session,
                messages: [],
                isLoading: false
              })
            }
          } else {
            console.log('[SessionStore] Failed to restore session, will auto-create later')
            set({ isLoading: false })
          }
        } catch (error) {
          console.error('[SessionStore] Error restoring session:', error)
          set({ 
            error: error instanceof Error ? error.message : 'Failed to restore session',
            isLoading: false
          })
        }
      },

      setSession: (session) => set({ session }),
      setMessages: (messages) => set({ messages }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error })
    }),
    {
      name: 'vibecode-session-storage',
      partialize: (state) => ({
        session: state.session,
        messages: state.messages
      })
    }
  )
)

export default useSessionStore