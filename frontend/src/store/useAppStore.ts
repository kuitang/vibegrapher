import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { debounce } from '../utils/debounce'
import type { Project, VibecodeSession, ConversationMessage, Diff } from './types'

interface AppState {
  // Persisted fields
  currentSession: VibecodeSession | null
  currentReviewDiff: Diff | null
  pendingDiffIds: string[]
  draftMessage: string
  lastActiveTime: number
  approvalMode: 'auto' | 'manual'
  hasHydrated: boolean
  
  // Non-persisted fields
  project: Project | null
  messages: ConversationMessage[]
  pendingDiffs: Diff[]
  isHydrating: boolean
  
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
    setDraftMessageDebounced: (message: string) => void
    setApprovalMode: (mode: 'auto' | 'manual') => void
    updateLastActiveTime: () => void
    clearStaleState: () => void
    clearPersistedState: () => void
    setHasHydrated: (hydrated: boolean) => void
  }
}

const STALE_TIME = 24 * 60 * 60 * 1000 // 24 hours

// Custom storage with error handling
const customStorage = createJSONStorage(() => {
  try {
    return localStorage
  } catch {
    // Fallback to in-memory storage if localStorage is unavailable
    console.warn('localStorage unavailable, using in-memory storage')
    const memoryStorage: Storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null
    }
    return memoryStorage
  }
})

const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      // Create debounced draft save (500ms delay)
      const debouncedSetDraft = debounce((message: string) => {
        set({ 
          draftMessage: message,
          lastActiveTime: Date.now()
        })
      }, 500)
      
      return {
        // Initial state
        currentSession: null,
        currentReviewDiff: null,
        pendingDiffIds: [],
        draftMessage: '',
        lastActiveTime: Date.now(),
        approvalMode: 'manual',
        hasHydrated: false,
        project: null,
        messages: [],
        pendingDiffs: [],
        isHydrating: false,
        
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
          
          setDraftMessageDebounced: (message) => {
            // Update UI immediately
            set({ draftMessage: message })
            // Persist to localStorage with debounce
            debouncedSetDraft(message)
          },
          
          setApprovalMode: (mode) => set({ approvalMode: mode }),
          
          updateLastActiveTime: () => set({ lastActiveTime: Date.now() }),
          
          clearStaleState: () => {
            const now = Date.now()
            const lastActive = get().lastActiveTime
            if (now - lastActive > STALE_TIME) {
              console.log('Clearing stale state (>24 hours old)')
              set({
                currentSession: null,
                currentReviewDiff: null,
                pendingDiffIds: [],
                draftMessage: '',
                messages: [],
                pendingDiffs: []
              })
            }
          },
          
          clearPersistedState: () => {
            // Clear all persisted state (e.g., on logout)
            set({
              currentSession: null,
              currentReviewDiff: null,
              pendingDiffIds: [],
              draftMessage: '',
              lastActiveTime: Date.now(),
              approvalMode: 'manual',
              messages: [],
              pendingDiffs: []
            })
          },
          
          setHasHydrated: (hydrated) => set({ hasHydrated: hydrated })
        }
      }
    },
    {
      name: 'vibegrapher-storage',
      version: 1,
      storage: customStorage,
      partialize: (state) => ({
        currentSession: state.currentSession,
        currentReviewDiff: state.currentReviewDiff,
        pendingDiffIds: state.pendingDiffIds,
        draftMessage: state.draftMessage,
        lastActiveTime: state.lastActiveTime,
        approvalMode: state.approvalMode
      }),
      onRehydrateStorage: () => (state) => {
        // Called after rehydration is complete
        if (state) {
          console.log('State rehydrated from localStorage')
          state.actions.setHasHydrated(true)
          // Check for stale state
          state.actions.clearStaleState()
        }
      }
    }
  )
)

// Export actions separately for easier access
export const useAppActions = () => useAppStore((state) => state.actions)

// Export hook to check hydration status
export const useHydration = () => useAppStore((state) => state.hasHydrated)

export default useAppStore