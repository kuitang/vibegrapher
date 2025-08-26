import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import useAppStore from '../../src/store/useAppStore'

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] || null
  }
})()

// Replace global localStorage with mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
})

describe('Phase 002: Local State Persistence', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear()
    // Reset all mocks
    vi.clearAllMocks()
    // Reset the store to initial state
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
    localStorageMock.clear()
    vi.clearAllTimers()
    vi.restoreAllMocks()
  })

  test('persists selected state fields to localStorage', async () => {
    const { result } = renderHook(() => useAppStore())
    
    act(() => {
      result.current.actions.setCurrentSession({
        id: 'session-123',
        projectId: 'project-456',
        initialPrompt: 'Test prompt',
        currentCode: 'const test = true',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01'
      })
      result.current.actions.setDraftMessage('Draft message content')
      result.current.actions.setApprovalMode('auto')
    })

    // Wait a bit for persistence
    await waitFor(() => {
      const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
      expect(storedData.state).toBeDefined()
    })

    // Check localStorage
    const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
    expect(storedData.state).toMatchObject({
      currentSession: {
        id: 'session-123',
        projectId: 'project-456'
      },
      draftMessage: 'Draft message content',
      approvalMode: 'auto'
    })
  })

  test('does not persist non-persisted fields', async () => {
    const { result } = renderHook(() => useAppStore())
    
    act(() => {
      result.current.actions.setProject({
        id: 'project-123',
        name: 'Test Project',
        slug: 'test-project',
        repositoryPath: '/path',
        currentCode: null,
        currentCommit: null,
        currentBranch: 'main',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01'
      })
      result.current.actions.setMessages([
        {
          id: 'msg-1',
          sessionId: 'session-123',
          role: 'user',
          content: 'Test message',
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01'
        }
      ])
    })

    // Wait a bit for any potential persistence
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check localStorage doesn't contain these fields
    const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
    expect(storedData.state?.project).toBeUndefined()
    expect(storedData.state?.messages).toBeUndefined()
  })

  test('rehydrates state from localStorage on initialization', async () => {
    // Set initial state in localStorage
    const initialState = {
      state: {
        currentSession: { id: 'session-999', projectId: 'project-999' },
        draftMessage: 'Recovered draft',
        approvalMode: 'auto',
        lastActiveTime: Date.now()
      },
      version: 1
    }
    localStorageMock.setItem('vibegrapher-storage', JSON.stringify(initialState))

    // Reset store completely to simulate fresh initialization
    useAppStore.persist.clearStorage()
    
    // Trigger rehydration
    await act(async () => {
      await useAppStore.persist.rehydrate()
    })

    const state = useAppStore.getState()
    
    // Check state was recovered
    expect(state.currentSession?.id).toBe('session-999')
    expect(state.draftMessage).toBe('Recovered draft')
    expect(state.approvalMode).toBe('auto')
  })

  test('clears stale state after 24 hours', async () => {
    const twentyFiveHoursAgo = Date.now() - (25 * 60 * 60 * 1000)
    
    // Set stale state in localStorage
    const staleState = {
      state: {
        currentSession: { id: 'old-session', projectId: 'old-project' },
        draftMessage: 'Old draft',
        lastActiveTime: twentyFiveHoursAgo,
        approvalMode: 'manual'
      },
      version: 1
    }
    localStorageMock.setItem('vibegrapher-storage', JSON.stringify(staleState))

    // Reset and rehydrate
    useAppStore.persist.clearStorage()
    
    await act(async () => {
      await useAppStore.persist.rehydrate()
    })

    const state = useAppStore.getState()
    
    // Check stale state was cleared
    expect(state.currentSession).toBeNull()
    expect(state.draftMessage).toBe('')
  })

  test('debounces draft message saving', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAppStore())

    // Type multiple characters quickly
    act(() => {
      result.current.actions.setDraftMessageDebounced('H')
      result.current.actions.setDraftMessageDebounced('He')
      result.current.actions.setDraftMessageDebounced('Hel')
      result.current.actions.setDraftMessageDebounced('Hell')
      result.current.actions.setDraftMessageDebounced('Hello')
    })

    // UI should update immediately
    expect(result.current.draftMessage).toBe('Hello')

    // Fast forward 500ms (debounce delay)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Wait for persistence
    await vi.runAllTimersAsync()

    // Now localStorage should be updated
    const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
    expect(storedData.state?.draftMessage).toBe('Hello')

    vi.useRealTimers()
  })

  test('gracefully handles localStorage errors', () => {
    // Temporarily replace localStorage with one that throws
    const brokenStorage = {
      getItem: () => { throw new Error('Storage error') },
      setItem: () => { throw new Error('Storage error') },
      removeItem: () => { throw new Error('Storage error') },
      clear: () => { throw new Error('Storage error') },
      length: 0,
      key: () => null
    }

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    // Replace localStorage temporarily
    const originalStorage = global.localStorage
    Object.defineProperty(global, 'localStorage', {
      value: brokenStorage,
      writable: true,
      configurable: true
    })

    // Should not crash when using broken storage
    const { result } = renderHook(() => useAppStore())
    
    act(() => {
      result.current.actions.setDraftMessage('Test without working localStorage')
    })
    
    // State should still update in memory
    expect(result.current.draftMessage).toBe('Test without working localStorage')

    // Restore original localStorage
    Object.defineProperty(global, 'localStorage', {
      value: originalStorage,
      writable: true,
      configurable: true
    })
    
    warnSpy.mockRestore()
  })

  test('clearPersistedState clears all persisted fields', async () => {
    const { result } = renderHook(() => useAppStore())
    
    // Set some state
    act(() => {
      result.current.actions.setCurrentSession({
        id: 'session-to-clear',
        projectId: 'project-to-clear',
        initialPrompt: 'Clear me',
        currentCode: '',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01'
      })
      result.current.actions.setDraftMessage('Clear this draft')
      result.current.actions.setApprovalMode('auto')
    })

    // Wait for persistence
    await new Promise(resolve => setTimeout(resolve, 100))

    // Clear persisted state
    act(() => {
      result.current.actions.clearPersistedState()
    })

    // Check all fields are cleared
    expect(result.current.currentSession).toBeNull()
    expect(result.current.draftMessage).toBe('')
    expect(result.current.approvalMode).toBe('manual')
    
    // Wait for persistence
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Check localStorage is also cleared
    const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
    expect(storedData.state?.currentSession).toBeNull()
    expect(storedData.state?.draftMessage).toBe('')
  })

  test('updates lastActiveTime on user actions', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAppStore())
    const initialTime = result.current.lastActiveTime

    // Advance time
    vi.advanceTimersByTime(1000)

    // Perform action that updates lastActiveTime
    act(() => {
      result.current.actions.setDraftMessage('New message')
    })

    expect(result.current.lastActiveTime).toBeGreaterThan(initialTime)
    
    vi.useRealTimers()
  })

  test('preserves approval mode preference', async () => {
    const { result } = renderHook(() => useAppStore())
    
    // Set approval mode
    act(() => {
      result.current.actions.setApprovalMode('auto')
    })

    // Wait for persistence
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check it's persisted
    const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
    expect(storedData.state?.approvalMode).toBe('auto')
  })

  test('preserves pending diff IDs but not full diff objects', async () => {
    const { result } = renderHook(() => useAppStore())
    
    act(() => {
      // Set IDs (should be persisted)
      result.current.actions.setPendingDiffIds(['diff-1', 'diff-2', 'diff-3'])
      
      // Set full objects (should NOT be persisted)
      result.current.actions.setPendingDiffs([
        {
          id: 'diff-1',
          sessionId: 'session-1',
          patch: 'patch content',
          status: 'pending',
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01'
        }
      ])
    })

    // Wait for persistence
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check localStorage
    const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
    expect(storedData.state?.pendingDiffIds).toEqual(['diff-1', 'diff-2', 'diff-3'])
    expect(storedData.state?.pendingDiffs).toBeUndefined()
  })
})