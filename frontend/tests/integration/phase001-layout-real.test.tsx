import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectLayout } from '@/components/layout/MainLayout'
import { HomePage } from '@/pages/HomePage'
import useAppStore from '@/store/useAppStore'

const API_URL = 'http://localhost:8000'

// Helper to check backend health
async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/projects`)
    return response.ok
  } catch {
    return false
  }
}

// Helper to create a test project
async function createTestProject(name: string) {
  const response = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  if (!response.ok) throw new Error('Failed to create project')
  return response.json()
}

// Helper to delete a project
async function deleteProject(id: string) {
  await fetch(`${API_URL}/projects/${id}`, {
    method: 'DELETE'
  })
}

// Helper to wrap components with providers
function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
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

describe('Phase 001: Layout with Real Backend', () => {
  let testProjectId: string | null = null

  beforeAll(async () => {
    // CRITICAL: Verify backend is running
    const isBackendUp = await checkBackendHealth()
    if (!isBackendUp) {
      throw new Error(
        'BACKEND NOT RUNNING! Start the backend first with:\n' +
        'cd backend && source venv/bin/activate && uvicorn app.main:app --reload'
      )
    }
  })

  afterAll(async () => {
    // Clean up test project if created
    if (testProjectId) {
      await deleteProject(testProjectId)
    }
  })

  describe('HomePage with Real Backend', () => {
    it('should fetch and display real projects from backend', async () => {
      renderWithProviders(<HomePage />)
      
      // Should show loading state initially
      expect(screen.getByText(/Loading projects/i)).toBeInTheDocument()
      
      // Wait for projects to load from real backend
      await waitFor(() => {
        expect(screen.queryByText(/Loading projects/i)).not.toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Should show Projects heading
      expect(screen.getByText('Projects')).toBeInTheDocument()
      
      // Should show create project form  
      const input = document.querySelector('input[placeholder="Project name"]')
      expect(input).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    })

    it('should create a real project via backend API', async () => {
      renderWithProviders(<HomePage />)
      
      // Wait for page to load
      await waitFor(() => {
        expect(screen.queryByText(/Loading projects/i)).not.toBeInTheDocument()
      })
      
      const projectName = `Test Project ${Date.now()}`
      const input = document.querySelector('input[placeholder="Project name"]') as HTMLInputElement
      const createButton = screen.getByRole('button', { name: 'Create' })
      
      // Type project name and create
      fireEvent.change(input, { target: { value: projectName } })
      fireEvent.click(createButton)
      
      // Wait for project to appear (real backend call)
      await waitFor(() => {
        expect(screen.getByText(projectName)).toBeInTheDocument()
      }, { timeout: 10000 })
      
      // Verify the project has Open and Delete buttons
      const projectCard = screen.getByText(projectName).closest('.bg-card')
      expect(projectCard).toBeInTheDocument()
      
      // Store ID for cleanup - get it from the actual backend
      const response = await fetch(`${API_URL}/projects`)
      const projects = await response.json()
      const createdProject = projects.find((p: { name: string }) => p.name === projectName)
      if (createdProject) {
        testProjectId = createdProject.id
      }
    })

    it('should delete a project via backend API', async () => {
      // First create a project to delete
      const projectName = `Delete Test ${Date.now()}`
      await createTestProject(projectName)
      
      renderWithProviders(<HomePage />)
      
      // Wait for projects to load
      await waitFor(() => {
        expect(screen.getByText(projectName)).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Find and click delete button for this project
      const projectCard = screen.getByText(projectName).closest('.bg-card')
      const deleteButton = projectCard?.querySelector('button.bg-destructive') as HTMLElement
      expect(deleteButton).toBeInTheDocument()
      
      fireEvent.click(deleteButton)
      
      // Wait for project to disappear (real backend delete)
      await waitFor(() => {
        expect(screen.queryByText(projectName)).not.toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

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
  })

  describe('Frontend Server Check', () => {
    it('should verify frontend dev server is running', async () => {
      try {
        const response = await fetch('http://localhost:5173')
        expect(response.ok).toBe(true)
        const html = await response.text()
        expect(html).toContain('<!doctype html>')
      } catch {
        throw new Error(
          'FRONTEND SERVER NOT RUNNING! Start it with:\n' +
          'cd frontend && npm run dev'
        )
      }
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
  })
})