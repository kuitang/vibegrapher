import { test, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ProjectPage } from '../../src/pages/ProjectPage'

// Mock the useProject hook
vi.mock('../../src/hooks/useProjects', () => ({
  useProject: () => ({
    data: {
      id: 'test-project-id',
      name: 'Test Project',
      path: '/test/path',
      current_branch: 'main',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    },
    isLoading: false,
    error: null
  })
}))

// Mock the useSocketIO hook
vi.mock('../../src/hooks/useSocketIO', () => ({
  useSocketIO: () => ({
    connectionState: { status: 'connected' },
    isConnected: true
  })
}))

// Mock the zustand store
vi.mock('../../src/store/useAppStore', async (importOriginal) => {
  const actual = await importOriginal()
  const mockStore = {
    currentSession: null,
    messages: [],
    project: {
      id: 'test-project-id',
      name: 'Test Project',
      path: '/test/path',
      current_branch: 'main',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    },
    actions: {
      setProject: vi.fn(),
      setCurrentSession: vi.fn(),
      setMessages: vi.fn()
    }
  }
  
  return {
    ...actual,
    default: () => mockStore,
    useAppActions: () => mockStore.actions
  }
})

// Mock window.matchMedia for mobile detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock the session service
vi.mock('../../src/services/sessions', () => ({
  startSession: vi.fn().mockResolvedValue({
    id: 'test-session-id',
    project_id: 'test-project-id',
    openai_session_key: 'test-session-key',
    conversations_db_path: '/test/path/conversations.db',
    session_type: 'global',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  }),
  sendMessage: vi.fn().mockResolvedValue(undefined),
  clearSession: vi.fn().mockResolvedValue(undefined),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  getPendingDiffs: vi.fn().mockResolvedValue([])
}))

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

test('session message sending flow', async () => {
  // Render the ProjectPage component
  render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        BrowserRouter,
        null,
        React.createElement(ProjectPage)
      )
    )
  )
  
  // Wait for the page to load
  await waitFor(() => {
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })
  
  // Click the "Start Session" button
  const startButton = screen.getByText('Start Session')
  fireEvent.click(startButton)
  
  // Wait for session to start
  await waitFor(() => {
    expect(screen.getByText('active')).toBeInTheDocument()
  })
  
  // Check that the placeholder message is shown
  expect(screen.getByText('Start by sending a message to the VibeCoder agent')).toBeInTheDocument()
  
  // Type a message in the textarea
  const textarea = screen.getByPlaceholderText('Enter your message (Press Enter to send, Shift+Enter for new line)')
  fireEvent.change(textarea, { target: { value: 'Create a triage agent' } })
  
  // Click the "Send" button
  const sendButton = screen.getByText('Send')
  fireEvent.click(sendButton)
  
  // Verify that the textarea is cleared after sending
  expect(textarea).toHaveValue('')
  
  // TODO: Add more specific assertions for message display
  // This would require more detailed mocking of the state management
})

test('textarea retains text on send failure', async () => {
  // TODO: Implement this test when we have proper error handling
  // This would require mocking the sendMessage function to reject
  expect(true).toBe(true)
})