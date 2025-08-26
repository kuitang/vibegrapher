/**
 * Session Store - Phase 005
 * Manages vibecode session state and message history
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string | Record<string, unknown>
  agent_type?: 'vibecoder' | 'evaluator'
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
        
        // If we already have a session for this project, load its messages
        if (state.session && state.session.project_id === projectId) {
          console.log('[SessionStore] Loading messages for existing session:', state.session.id)
          
          try {
            // Load messages from API
            const response = await fetch(`${API_URL}/sessions/${state.session.id}/messages`)
            if (response.ok) {
              const messages = await response.json()
              
              // Format messages to match our Message type
              const formattedMessages: Message[] = messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
                agent_type: msg.agent_type || (msg.role === 'assistant' ? 'vibecoder' : msg.role === 'system' ? 'evaluator' : undefined),
                iteration: msg.iteration,
                session_id: msg.session_id,
                timestamp: msg.created_at || new Date().toISOString(),
                token_usage: msg.token_usage
              }))
              
              set({ messages: formattedMessages })
              console.log('[SessionStore] Loaded', formattedMessages.length, 'messages')
            }
          } catch (error) {
            console.error('[SessionStore] Error loading messages:', error)
          }
          
          return
        }

        // Otherwise clear the session for new project
        set({
          session: null,
          messages: [],
          error: null
        })
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