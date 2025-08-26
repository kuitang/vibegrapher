import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, VibecodeSession, ConversationMessage, Diff } from './types'

interface AppState {
  // Persisted fields
  currentSession: VibecodeSession | null
  currentReviewDiff: Diff | null
  pendingDiffIds: string[]
  draftMessage: string
  lastActiveTime: number
  approvalMode: 'auto' | 'manual'
  
  // Non-persisted fields
  project: Project | null
  messages: ConversationMessage[]
  pendingDiffs: Diff[]
  
  // Actions
  actions: {
    setProject: (project: Project | null) => void
    setCurrentSession: (session: VibecodeSession | null) => void
    setMessages: (messages: ConversationMessage[]) => void
    addMessage: (message: ConversationMessage) => void
    setCurrentReviewDiff: (diff: Diff | null) => void
    setPendingDiffIds: (ids: string[]) => void
    setPendingDiffs: (diffs: Diff[]) => void
    setDraftMessage: (message: string) => void
    setApprovalMode: (mode: 'auto' | 'manual') => void
    updateLastActiveTime: () => void
    clearStaleState: () => void
  }
}

const STALE_TIME = 24 * 60 * 60 * 1000 // 24 hours

const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      currentReviewDiff: null,
      pendingDiffIds: [],
      draftMessage: '',
      lastActiveTime: Date.now(),
      approvalMode: 'manual',
      project: null,
      messages: [],
      pendingDiffs: [],
      
      actions: {
        setProject: (project) => set({ project }),
        
        setCurrentSession: (session) => set({ 
          currentSession: session,
          lastActiveTime: Date.now()
        }),
        
        setMessages: (messages) => set({ messages }),
        
        addMessage: (message) => set((state) => ({
          messages: [...state.messages, message]
        })),
        
        setCurrentReviewDiff: (diff) => set({ 
          currentReviewDiff: diff,
          lastActiveTime: Date.now()
        }),
        
        setPendingDiffIds: (ids) => set({ pendingDiffIds: ids }),
        
        setPendingDiffs: (diffs) => set({ pendingDiffs: diffs }),
        
        setDraftMessage: (message) => set({ 
          draftMessage: message,
          lastActiveTime: Date.now()
        }),
        
        setApprovalMode: (mode) => set({ approvalMode: mode }),
        
        updateLastActiveTime: () => set({ lastActiveTime: Date.now() }),
        
        clearStaleState: () => {
          const now = Date.now()
          const lastActive = get().lastActiveTime
          if (now - lastActive > STALE_TIME) {
            set({
              currentSession: null,
              currentReviewDiff: null,
              pendingDiffIds: [],
              draftMessage: '',
              messages: [],
              pendingDiffs: []
            })
          }
        }
      }
    }),
    {
      name: 'vibegrapher-storage',
      version: 1,
      partialize: (state) => ({
        currentSession: state.currentSession,
        currentReviewDiff: state.currentReviewDiff,
        pendingDiffIds: state.pendingDiffIds,
        draftMessage: state.draftMessage,
        lastActiveTime: state.lastActiveTime,
        approvalMode: state.approvalMode
      })
    }
  )
)

// Export actions separately for easier access
export const useAppActions = () => useAppStore((state) => state.actions)

export default useAppStore