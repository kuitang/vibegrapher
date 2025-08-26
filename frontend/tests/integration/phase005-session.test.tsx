import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { VibecodePanel } from '../../src/components/vibecode/VibecodePanel'
import type { ConnectionState } from '../../src/services/socketio'

// Mock the useParams hook
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: 'test-project-id' })
  }
})

// Mock the useSession hook
vi.mock('../../src/hooks/useSession', () => ({
  useSession: () => ({
    session: null,
    messages: [],
    start: vi.fn(),
    send: vi.fn(),
    clear: vi.fn(),
    isStarting: false,
    isSending: false,
    isClearing: false,
    messagesLoading: false,
    diffsLoading: false,
    startError: null,
    sendError: null,
    clearError: null
  })
}))

// Mock the useAppStore
vi.mock('../../src/store/useAppStore', () => ({
  __esModule: true,
  default: () => ({
    project: {
      id: 'test-project-id',
      name: 'Test Project',
      slug: 'test-project',
      repository_path: '/test/path',
      current_code: null,
      current_commit: null,
      current_branch: 'main',
      created_at: '2025-01-01',
      updated_at: '2025-01-01'
    },
    messages: []
  }),
  useAppActions: () => ({
    setProject: vi.fn(),
    setCurrentSession: vi.fn(),
    setMessages: vi.fn(),
    addMessage: vi.fn(),
    setCurrentReviewDiff: vi.fn(),
    setPendingDiffIds: vi.fn(),
    setPendingDiffs: vi.fn(),
    setDraftMessage: vi.fn(),
    setDraftMessageDebounced: vi.fn(),
    setApprovalMode: vi.fn(),
    updateLastActiveTime: vi.fn(),
    clearStaleState: vi.fn(),
    clearPersistedState: vi.fn(),
    setHasHydrated: vi.fn()
  })
}))

const mockConnectionState: ConnectionState = 'connected'

describe('Phase 005: Session Management', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  test('renders VibecodePanel with start session button', () => {
    renderWithProviders(
      <VibecodePanel 
        projectId="test-project-id" 
        connectionState={mockConnectionState} 
        socketMessages={[]} 
      />
    )
    
    // Check that the panel title is rendered
    expect(screen.getByText('Vibecode Panel')).toBeInTheDocument()
    
    // Check that the start session button is rendered
    expect(screen.getByRole('button', { name: /start session/i })).toBeInTheDocument()
    
    // Check that the connection status is rendered
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })
})