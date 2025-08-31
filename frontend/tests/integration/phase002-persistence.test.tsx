import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import useAppStore, { useAppActions } from '../../src/store/useAppStore'

// Store reset functions for cleanup between tests
const storeResetFns = new Set<() => void>()

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] || null
  }
})()

// Replace global localStorage with mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
})

describe('Phase 002: Local State Persistence', () => {
  beforeEach(async () => {
    // Clear localStorage mock and reset its spies
    localStorageMock.clear()
    vi.clearAllMocks()
    
    // Reset all stores that were created during tests
    storeResetFns.forEach((resetFn) => resetFn())
    
    // Clear zustand persistence
    useAppStore.persist.clearStorage()
  })

  afterEach(() => {
    // Reset everything
    localStorageMock.clear()
    vi.clearAllTimers()
    vi.restoreAllMocks()
    
    // Reset all stores
    storeResetFns.forEach((resetFn) => resetFn())
    storeResetFns.clear()
  })

  test('persists selected state fields to localStorage', async () => {
    const { result } = renderHook(() => useAppStore())
    
    // Store reset function for cleanup
    storeResetFns.add(() => useAppStore.persist.clearStorage())
    
    await act(async () => {
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

    // Wait for zustand persist to complete
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalled()
    }, { timeout: 2000 })

    // Verify the setItem call
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'vibegrapher-storage',
      expect.stringContaining('session-123')
    )
    
    // Verify persistence worked
    const lastCall = localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1]
    const storedData = JSON.parse(lastCall[1])
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
    // Setup mock to return predefined state
    const persistedData = {
      state: {
        currentSession: { id: 'session-999', projectId: 'project-999' },
        draftMessage: 'Recovered draft',
        approvalMode: 'auto',
        lastActiveTime: Date.now()
      },
      version: 1
    }
    
    // Mock getItem to return our test data
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'vibegrapher-storage') {
        return JSON.stringify(persistedData)
      }
      return null
    })
    
    // Store reset function for cleanup
    storeResetFns.add(() => useAppStore.persist.clearStorage())

    // Trigger rehydration
    await act(async () => {
      await useAppStore.persist.rehydrate()
    })

    // Verify getItem was called
    expect(localStorageMock.getItem).toHaveBeenCalledWith('vibegrapher-storage')

    // Wait for state to be rehydrated
    await waitFor(() => {
      const state = useAppStore.getState()
      expect(state.currentSession?.id).toBe('session-999')
    }, { timeout: 1000 })

    const state = useAppStore.getState()
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

    // Store reset function for cleanup
    storeResetFns.add(() => useAppStore.persist.clearStorage())

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

    // Fast forward past the 500ms debounce delay
    await act(async () => {
      vi.advanceTimersByTime(600)
      await vi.runAllTimersAsync()
    })

    // Verify debounced persistence happened
    await vi.waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vibegrapher-storage',
        expect.stringContaining('Hello')
      )
    }, { timeout: 1000 })

    vi.useRealTimers()
  }, 10000)

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
    await act(async () => {
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
      
      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    // Clear persisted state
    await act(async () => {
      result.current.actions.clearPersistedState()
      // Wait for persistence to complete
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    // Check all fields are cleared
    expect(result.current.currentSession).toBeNull()
    expect(result.current.draftMessage).toBe('')
    expect(result.current.approvalMode).toBe('manual')
    
    // Check localStorage is also cleared
    await waitFor(() => {
      const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
      expect(storedData.state?.currentSession).toBeNull()
      expect(storedData.state?.draftMessage).toBe('')
    }, { timeout: 1000 })
  }, 10000)

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
    await act(async () => {
      result.current.actions.setApprovalMode('auto')
      // Wait for zustand persist
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    // Wait for persistence to complete
    await waitFor(() => {
      const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
      expect(storedData.state?.approvalMode).toBe('auto')
    }, { timeout: 1000 })
  })

  test('preserves pending diff IDs but not full diff objects', async () => {
    const { result } = renderHook(() => useAppStore())
    
    await act(async () => {
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
      
      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    // Wait for persistence to complete
    await waitFor(() => {
      const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
      expect(storedData.state?.pendingDiffIds).toEqual(['diff-1', 'diff-2', 'diff-3'])
    }, { timeout: 1000 })

    // Check localStorage
    const storedData = JSON.parse(localStorageMock.getItem('vibegrapher-storage') || '{}')
    expect(storedData.state?.pendingDiffIds).toEqual(['diff-1', 'diff-2', 'diff-3'])
    expect(storedData.state?.pendingDiffs).toBeUndefined()
  })
})