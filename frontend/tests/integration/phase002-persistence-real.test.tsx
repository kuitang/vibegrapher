import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useAppStore from '../../src/store/useAppStore'

describe('Phase 002: Local State Persistence (Real localStorage)', () => {
  beforeEach(() => {
    // Clear real localStorage
    localStorage.clear()
    // Reset the store
    useAppStore.setState({
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
      isHydrating: false
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  test('persists and retrieves state from real localStorage', () => {
    const { result } = renderHook(() => useAppStore())
    
    // Set some state
    act(() => {
      result.current.actions.setCurrentSession({
        id: 'real-session-123',
        projectId: 'real-project-456',
        initialPrompt: 'Real test prompt',
        currentCode: 'const real = true',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01'
      })
      result.current.actions.setDraftMessage('Real draft message')
      result.current.actions.setApprovalMode('auto')
    })

    // Manually check localStorage (Zustand writes immediately with localStorage)
    const stored = localStorage.getItem('vibegrapher-storage')
    expect(stored).toBeTruthy()
    
    const parsed = JSON.parse(stored || '{}')
    expect(parsed.state).toBeDefined()
    expect(parsed.state.currentSession).toMatchObject({
      id: 'real-session-123',
      projectId: 'real-project-456'
    })
    expect(parsed.state.draftMessage).toBe('Real draft message')
    expect(parsed.state.approvalMode).toBe('auto')
  })

  test('rehydrates from real localStorage on store creation', async () => {
    // Manually set data in localStorage
    const testData = {
      state: {
        currentSession: { id: 'hydrate-test', projectId: 'hydrate-project' },
        draftMessage: 'Hydrated message',
        approvalMode: 'auto',
        lastActiveTime: Date.now(),
        currentReviewDiff: null,
        pendingDiffIds: []
      },
      version: 1
    }
    localStorage.setItem('vibegrapher-storage', JSON.stringify(testData))
    
    // Clear the store state first
    useAppStore.setState({
      currentSession: null,
      draftMessage: '',
      approvalMode: 'manual'
    })
    
    // Force rehydration
    await useAppStore.persist.rehydrate()
    
    // Check the state was restored
    const state = useAppStore.getState()
    expect(state.currentSession?.id).toBe('hydrate-test')
    expect(state.draftMessage).toBe('Hydrated message')
    expect(state.approvalMode).toBe('auto')
  })

  test('clearPersistedState removes data from localStorage', () => {
    const { result } = renderHook(() => useAppStore())
    
    // Set some state
    act(() => {
      result.current.actions.setCurrentSession({
        id: 'to-clear',
        projectId: 'clear-project',
        initialPrompt: 'Clear me',
        currentCode: '',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01'
      })
      result.current.actions.setDraftMessage('Clear this')
    })
    
    // Verify it's in localStorage
    let stored = localStorage.getItem('vibegrapher-storage')
    expect(stored).toBeTruthy()
    
    // Clear persisted state
    act(() => {
      result.current.actions.clearPersistedState()
    })
    
    // Check state is cleared
    expect(result.current.currentSession).toBeNull()
    expect(result.current.draftMessage).toBe('')
    
    // Check localStorage is updated
    stored = localStorage.getItem('vibegrapher-storage')
    if (stored) {
      const parsed = JSON.parse(stored)
      expect(parsed.state.currentSession).toBeNull()
      expect(parsed.state.draftMessage).toBe('')
    }
  })

  test('does not persist non-persisted fields', () => {
    const { result } = renderHook(() => useAppStore())
    
    // Set both persisted and non-persisted fields
    act(() => {
      result.current.actions.setDraftMessage('This should persist')
      result.current.actions.setProject({
        id: 'non-persisted',
        name: 'Should not persist',
        slug: 'test',
        repositoryPath: '/test',
        currentCode: null,
        currentCommit: null,
        currentBranch: 'main',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01'
      })
      result.current.actions.setMessages([
        {
          id: 'msg-1',
          sessionId: 'test',
          role: 'user',
          content: 'Should not persist',
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01'
        }
      ])
    })
    
    // Check localStorage
    const stored = localStorage.getItem('vibegrapher-storage')
    expect(stored).toBeTruthy()
    
    const parsed = JSON.parse(stored || '{}')
    expect(parsed.state.draftMessage).toBe('This should persist')
    expect(parsed.state.project).toBeUndefined()
    expect(parsed.state.messages).toBeUndefined()
  })

  test('clears stale state older than 24 hours', async () => {
    const twentyFiveHoursAgo = Date.now() - (25 * 60 * 60 * 1000)
    
    // Set stale data in localStorage
    const staleData = {
      state: {
        currentSession: { id: 'stale-session', projectId: 'stale-project' },
        draftMessage: 'Stale message',
        lastActiveTime: twentyFiveHoursAgo,
        approvalMode: 'manual',
        currentReviewDiff: null,
        pendingDiffIds: []
      },
      version: 1
    }
    localStorage.setItem('vibegrapher-storage', JSON.stringify(staleData))
    
    // Clear current store state
    useAppStore.setState({
      currentSession: null,
      draftMessage: '',
      lastActiveTime: twentyFiveHoursAgo
    })
    
    // Force rehydration which should trigger stale cleanup
    await useAppStore.persist.rehydrate()
    
    // The clearStaleState should have been called
    const state = useAppStore.getState()
    expect(state.currentSession).toBeNull()
    expect(state.draftMessage).toBe('')
  })
})