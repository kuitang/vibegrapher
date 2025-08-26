import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectLayout, DarkModeToggle } from '@/components/layout/MainLayout'
import useAppStore from '@/store/useAppStore'

// Helper to wrap components with providers
function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Phase 001: Layout Components', () => {
  describe('ProjectLayout', () => {
    it('should render three panels with correct test IDs', () => {
      renderWithProviders(
        <ProjectLayout
          vibecodePanel={<div>Vibecode Content</div>}
          codePanel={<div>Code Content</div>}
          testPanel={<div>Test Content</div>}
        />
      )

      // Verify all three panels are present with test IDs
      const vibecodePanel = screen.getByTestId('vibecode-panel')
      const codePanel = screen.getByTestId('code-panel')
      const testPanel = screen.getByTestId('test-panel')

      expect(vibecodePanel).toBeInTheDocument()
      expect(codePanel).toBeInTheDocument()
      expect(testPanel).toBeInTheDocument()

      // Verify they are Card components (have the card class)
      expect(vibecodePanel).toHaveClass('bg-card')
      expect(codePanel).toHaveClass('bg-card')
      expect(testPanel).toHaveClass('bg-card')
    })

    it('should render exactly 3 Card panels', () => {
      const { container } = renderWithProviders(
        <ProjectLayout
          vibecodePanel={<div>Vibecode</div>}
          codePanel={<div>Code</div>}
          testPanel={<div>Test</div>}
        />
      )

      // Count elements with card background class
      const cards = container.querySelectorAll('.bg-card')
      expect(cards).toHaveLength(3)
    })
  })

  describe('DarkModeToggle', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear()
      document.documentElement.classList.remove('dark')
    })

    it('should toggle dark mode when clicked', () => {
      renderWithProviders(<DarkModeToggle />)
      
      const switchElement = screen.getByRole('switch', { name: /toggle dark mode/i })
      
      // Initially should be unchecked (light mode)
      expect(switchElement).toHaveAttribute('data-state', 'unchecked')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      
      // Click to enable dark mode
      fireEvent.click(switchElement)
      expect(switchElement).toHaveAttribute('data-state', 'checked')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(localStorage.getItem('darkMode')).toBe('true')
      
      // Click to disable dark mode
      fireEvent.click(switchElement)
      expect(switchElement).toHaveAttribute('data-state', 'unchecked')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(localStorage.getItem('darkMode')).toBe('false')
    })

    it('should persist dark mode preference in localStorage', () => {
      const { rerender } = renderWithProviders(<DarkModeToggle />)
      
      const switchElement = screen.getByRole('switch', { name: /toggle dark mode/i })
      
      // Enable dark mode
      fireEvent.click(switchElement)
      expect(localStorage.getItem('darkMode')).toBe('true')
      
      // Simulate page reload by remounting component
      rerender(<DarkModeToggle />)
      
      // Should still be in dark mode
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('Zustand Store', () => {
    beforeEach(() => {
      // Reset store state
      useAppStore.setState({
        currentSession: null,
        currentReviewDiff: null,
        pendingDiffIds: [],
        draftMessage: '',
        lastActiveTime: Date.now(),
        approvalMode: 'manual',
        project: null,
        messages: [],
        pendingDiffs: []
      })
    })

    it('should initialize with empty state', () => {
      const state = useAppStore.getState()
      
      expect(state.currentSession).toBeNull()
      expect(state.project).toBeNull()
      expect(state.messages).toEqual([])
      expect(state.pendingDiffs).toEqual([])
      expect(state.approvalMode).toBe('manual')
    })

    it('should update project state', () => {
      const mockProject = {
        id: '123',
        name: 'Test Project',
        slug: 'test-project',
        repository_path: '/test/path',
        current_code: '',
        current_commit: 'abc123',
        current_branch: 'main',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      }
      
      const { actions } = useAppStore.getState()
      actions.setProject(mockProject)
      
      const state = useAppStore.getState()
      expect(state.project).toEqual(mockProject)
    })
  })
})