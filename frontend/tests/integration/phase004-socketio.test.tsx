import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSocketIO } from '../../src/hooks/useSocketIO'
import socketIOService from '../../src/services/socketio'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false
  }))
}))

describe('Phase 004: Socket.io Setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    socketIOService.disconnect()
  })

  test('connects to Socket.io server for project', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    const { result } = renderHook(() => 
      useSocketIO('test-project-123', {})
    )
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useSocketIO] Connecting to project:', 
        'test-project-123'
      )
    })
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Socket.io] Connecting to:',
      'http://localhost:8000',
      'for project:',
      'test-project-123'
    )
  })

  test('handles conversation message events', async () => {
    const onMessage = vi.fn()
    const testMessage = {
      agent_type: 'vibecoder' as const,
      iteration: 0,
      session_id: 'test-session',
      timestamp: new Date().toISOString(),
      content: { text: 'Test response' }
    }
    
    renderHook(() => 
      useSocketIO('test-project', {
        onConversationMessage: onMessage
      })
    )
    
    // Simulate message from service
    act(() => {
      const listeners = (socketIOService as any).listeners.get('conversation_message')
      if (listeners) {
        listeners.forEach((cb: Function) => cb(testMessage))
      }
    })
    
    expect(onMessage).toHaveBeenCalledWith(testMessage)
  })

  test('handles diff created events', async () => {
    const onDiff = vi.fn()
    const testDiff = {
      diff_id: 'diff-123',
      commit_message: 'Test commit',
      session_id: 'test-session',
      git_commit: 'abc123'
    }
    
    renderHook(() => 
      useSocketIO('test-project', {
        onDiffCreated: onDiff
      })
    )
    
    // Simulate diff event from service
    act(() => {
      const listeners = (socketIOService as any).listeners.get('diff_created')
      if (listeners) {
        listeners.forEach((cb: Function) => cb(testDiff))
      }
    })
    
    expect(onDiff).toHaveBeenCalledWith(testDiff)
  })

  test('handles connection state changes', async () => {
    const { result } = renderHook(() => 
      useSocketIO('test-project', {})
    )
    
    // Initial state
    expect(result.current.connectionState).toBe('disconnected')
    expect(result.current.isConnected).toBe(false)
    
    // Simulate connection state change
    act(() => {
      const listeners = (socketIOService as any).listeners.get('connection_state_change')
      if (listeners) {
        listeners.forEach((cb: Function) => cb('connected'))
      }
    })
    
    expect(result.current.connectionState).toBe('connected')
    expect(result.current.isConnected).toBe(true)
  })

  test('handles debug iteration events', async () => {
    const onDebug = vi.fn()
    const debugEvent = {
      iteration: 1,
      patch_content: 'test patch',
      patch_description: 'test description',
      evaluator_approved: false,
      evaluator_reasoning: 'needs improvement',
      evaluator_feedback: 'feedback'
    }
    
    renderHook(() => 
      useSocketIO('test-project', {
        onDebugIteration: onDebug
      })
    )
    
    // Simulate debug event
    act(() => {
      const listeners = (socketIOService as any).listeners.get('debug_iteration')
      if (listeners) {
        listeners.forEach((cb: Function) => cb(debugEvent))
      }
    })
    
    expect(onDebug).toHaveBeenCalledWith(debugEvent)
  })

  test('logs all messages with session_id', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    const testMessage = {
      agent_type: 'evaluator' as const,
      iteration: 1,
      session_id: 'session-456',
      timestamp: new Date().toISOString(),
      content: { approved: true }
    }
    
    renderHook(() => 
      useSocketIO('test-project', {
        onConversationMessage: () => {}
      })
    )
    
    // Simulate message
    act(() => {
      const listeners = (socketIOService as any).listeners.get('conversation_message')
      if (listeners) {
        listeners.forEach((cb: Function) => cb(testMessage))
      }
    })
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Socket.io] Conversation message:',
      testMessage,
      'session_id:',
      'session-456'
    )
  })

  test('disconnects on cleanup', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    const { unmount } = renderHook(() => 
      useSocketIO('test-project', {})
    )
    
    unmount()
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useSocketIO] Cleaning up Socket.io connection'
      )
    })
  })
})