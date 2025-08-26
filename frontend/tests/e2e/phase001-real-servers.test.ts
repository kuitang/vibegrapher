import { test, expect } from '@playwright/test'

const API_URL = 'http://localhost:8000'
const FRONTEND_URL = 'http://localhost:5173'

test.describe('Phase 001: E2E Tests with Real Servers', () => {
  test.beforeAll(async ({ request }) => {
    // Verify backend is running
    try {
      const response = await request.get(`${API_URL}/projects`)
      if (!response.ok()) {
        throw new Error('Backend returned non-OK status')
      }
    } catch (error) {
      throw new Error(
        `BACKEND NOT RUNNING at ${API_URL}!\n` +
        'Start the backend first with:\n' +
        'cd backend && source venv/bin/activate && uvicorn app.main:app --reload\n' +
        `Error: ${error}`
      )
    }

    // Verify frontend is running
    try {
      const response = await request.get(FRONTEND_URL)
      if (!response.ok()) {
        throw new Error('Frontend returned non-OK status')
      }
    } catch (error) {
      throw new Error(
        `FRONTEND NOT RUNNING at ${FRONTEND_URL}!\n` +
        'Start the frontend first with:\n' +
        'cd frontend && npm run dev\n' +
        `Error: ${error}`
      )
    }
  })

  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto(FRONTEND_URL)
    
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle')
  })

  test('should verify both servers are accessible', async ({ page, request }) => {
    // Check backend health
    const backendResponse = await request.get(`${API_URL}/projects`)
    expect(backendResponse.ok()).toBeTruthy()
    const projects = await backendResponse.json()
    expect(Array.isArray(projects)).toBeTruthy()

    // Check frontend loads
    await page.goto(FRONTEND_URL)
    await expect(page).toHaveTitle(/Vite \+ React \+ TS/)
    
    // Verify the app renders
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('should load projects from real backend', async ({ page }) => {
    // Wait for projects to load
    await expect(page.locator('h1').filter({ hasText: 'Projects' })).toBeVisible()
    
    // Should not show loading after data loads
    await expect(page.locator('text=Loading projects')).not.toBeVisible()
    
    // Should show create project form
    await expect(page.getByPlaceholder('Project name')).toBeVisible()
  })

  test('should create a real project in backend', async ({ page, request }) => {
    const projectName = `E2E Test ${Date.now()}`
    
    // Fill in project name
    await page.getByPlaceholder('Project name').fill(projectName)
    
    // Click create
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Wait for project to appear
    await expect(page.locator('text=' + projectName)).toBeVisible({ timeout: 10000 })
    
    // Verify project exists in backend
    const response = await request.get(`${API_URL}/projects`)
    const projects = await response.json()
    const createdProject = projects.find((p: { name: string; id?: string }) => p.name === projectName)
    expect(createdProject).toBeTruthy()
    expect(createdProject.name).toBe(projectName)
    
    // Clean up - delete the project
    if (createdProject?.id) {
      await request.delete(`${API_URL}/projects/${createdProject.id}`)
    }
  })

  test('should navigate to project page and show three panels', async ({ page, request }) => {
    // First create a project
    const projectName = `Navigation Test ${Date.now()}`
    const createResponse = await request.post(`${API_URL}/projects`, {
      data: { name: projectName }
    })
    const project = await createResponse.json()
    
    // Reload page to see new project
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Click open button for the project
    const projectCard = page.locator('text=' + projectName).locator('..').locator('..')
    await projectCard.getByRole('button', { name: 'Open' }).click()
    
    // Should navigate to project page
    await expect(page).toHaveURL(new RegExp(`/project/${project.id}`))
    
    // Verify three panels are visible
    await expect(page.getByTestId('vibecode-panel')).toBeVisible()
    await expect(page.getByTestId('code-panel')).toBeVisible()
    await expect(page.getByTestId('test-panel')).toBeVisible()
    
    // Clean up
    await request.delete(`${API_URL}/projects/${project.id}`)
  })

  test('should delete project via real backend', async ({ page, request }) => {
    // Create a project first
    const projectName = `Delete Test ${Date.now()}`
    const createResponse = await request.post(`${API_URL}/projects`, {
      data: { name: projectName }
    })
    const project = await createResponse.json()
    
    // Reload to see the project
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Find and click delete button
    const projectCard = page.locator('text=' + projectName).locator('..').locator('..')
    await projectCard.getByRole('button', { name: 'Delete' }).click()
    
    // Project should disappear
    await expect(page.locator('text=' + projectName)).not.toBeVisible({ timeout: 5000 })
    
    // Verify it's deleted from backend
    const response = await request.get(`${API_URL}/projects`)
    const projects = await response.json()
    const deletedProject = projects.find((p: { id: string }) => p.id === project.id)
    expect(deletedProject).toBeUndefined()
  })

  test('should persist dark mode across page navigation', async ({ page, request }) => {
    // Enable dark mode
    await page.getByRole('switch', { name: /toggle dark mode/i }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    
    // Create a project to navigate to
    const projectName = `Dark Mode Test ${Date.now()}`
    const createResponse = await request.post(`${API_URL}/projects`, {
      data: { name: projectName }
    })
    const project = await createResponse.json()
    
    // Navigate to project page
    await page.goto(`${FRONTEND_URL}/project/${project.id}`)
    
    // Dark mode should still be enabled
    await expect(page.locator('html')).toHaveClass(/dark/)
    
    // Go back to home
    await page.goto(FRONTEND_URL)
    
    // Dark mode should still be enabled
    await expect(page.locator('html')).toHaveClass(/dark/)
    
    // Clean up
    await request.delete(`${API_URL}/projects/${project.id}`)
  })

  test('should handle backend errors gracefully', async ({ page, context }) => {
    // Block backend API to simulate error
    await context.route(`${API_URL}/projects`, route => {
      route.abort('failed')
    })
    
    // Navigate to home page
    await page.goto(FRONTEND_URL)
    
    // Should show error message
    await expect(page.locator('text=/Error loading projects/i')).toBeVisible({ timeout: 10000 })
  })
})