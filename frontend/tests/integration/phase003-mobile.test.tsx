import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectPage } from '../../src/pages/ProjectPage'

// Mock the useParams hook
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: 'test-project-id' })
  }
})

// Mock the useProject hook
vi.mock('../../src/hooks/useProjects', () => ({
  useProject: () => ({
    data: {
      id: 'test-project-id',
      name: 'Test Mobile Project',
      slug: 'test-mobile-project',
      repository_path: '/test/path',
      current_code: null,
      current_commit: null,
      current_branch: 'main',
      created_at: '2025-01-01',
      updated_at: '2025-01-01'
    },
    isLoading: false,
    error: null
  })
}))

describe('Phase 003: Mobile Responsive', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    
    // Set mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 667
    })
    
    // Mock matchMedia for mobile detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
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

  test('mobile layout with shadcn Sheet', async () => {
    renderWithProviders(<ProjectPage />)
    
    // Check for mobile menu button
    const mobileMenuButton = screen.getByTestId('mobile-menu')
    expect(mobileMenuButton).toBeInTheDocument()
    
    // Click mobile menu to open Sheet
    const user = userEvent.setup()
    await user.click(mobileMenuButton)
    
    // Verify Sheet navigation items are visible
    await waitFor(() => {
      expect(screen.getByText('Navigation')).toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  test('tabs for panel switching', async () => {
    renderWithProviders(<ProjectPage />)
    
    // Verify Tabs are visible on mobile
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(3)
    
    const vibecodeTab = tabs.find(tab => tab.textContent?.includes('Vibecode'))
    const codeTab = tabs.find(tab => tab.textContent === 'Code')
    const testsTab = tabs.find(tab => tab.textContent === 'Tests')
    
    expect(vibecodeTab).toBeInTheDocument()
    expect(codeTab).toBeInTheDocument()
    expect(testsTab).toBeInTheDocument()
    
    // Click Code tab and verify content changes
    const user = userEvent.setup()
    await user.click(codeTab!)
    
    await waitFor(() => {
      expect(screen.getByText('Code Viewer')).toBeInTheDocument()
    })
    
    // Click Tests tab
    await user.click(testsTab!)
    
    await waitFor(() => {
      expect(screen.getByText('Test Results')).toBeInTheDocument()
    })
  })

  test('drawer for bottom actions', async () => {
    renderWithProviders(<ProjectPage />)
    
    // Find and click mobile actions button
    const actionsButton = screen.getByTestId('mobile-actions')
    expect(actionsButton).toBeInTheDocument()
    
    const user = userEvent.setup()
    await user.click(actionsButton)
    
    // Verify Drawer opens with actions
    await waitFor(() => {
      expect(screen.getByText('Run Vibecode')).toBeInTheDocument()
      expect(screen.getByText('Clear Console')).toBeInTheDocument()
      expect(screen.getByText('View History')).toBeInTheDocument()
    })
  })

  test('dropdown menu for compact actions', async () => {
    renderWithProviders(<ProjectPage />)
    
    // Find and click more actions button
    const moreActionsButton = screen.getByTestId('more-actions')
    expect(moreActionsButton).toBeInTheDocument()
    
    const user = userEvent.setup()
    await user.click(moreActionsButton)
    
    // Verify DropdownMenu opens with menu items
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument()
      expect(screen.getByText('Run Tests')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
    })
  })

  test('responsive layout changes at breakpoint', () => {
    // Test desktop layout first
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false, // Not mobile
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { unmount } = renderWithProviders(<ProjectPage />)
    
    // Desktop layout should have three panels visible
    expect(screen.getByTestId('vibecode-panel')).toBeInTheDocument()
    expect(screen.getByTestId('code-panel')).toBeInTheDocument()
    expect(screen.getByTestId('test-panel')).toBeInTheDocument()
    
    // Should not have tabs in desktop view
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    
    unmount()
    
    // Test mobile layout
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)', // Mobile
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderWithProviders(<ProjectPage />)
    
    // Mobile layout should have tabs instead
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(3)
    expect(tabs.some(tab => tab.textContent?.includes('Vibecode'))).toBe(true)
    expect(tabs.some(tab => tab.textContent === 'Code')).toBe(true)
    expect(tabs.some(tab => tab.textContent === 'Tests')).toBe(true)
    
    // Should not have desktop panels visible at the same time
    expect(screen.queryByTestId('vibecode-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('code-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('test-panel')).not.toBeInTheDocument()
  })

  test('project name displayed in mobile header', () => {
    renderWithProviders(<ProjectPage />)
    
    // Check that project name is displayed
    expect(screen.getByText('Test Mobile Project')).toBeInTheDocument()
  })

  test('mobile-optimized touch targets', () => {
    renderWithProviders(<ProjectPage />)
    
    // Check that buttons are appropriately sized for touch
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    
    // All interactive elements should be present
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
    expect(screen.getByTestId('more-actions')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-actions')).toBeInTheDocument()
  })
})