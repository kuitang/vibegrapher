import { test, expect } from '@playwright/test'

test.describe('Phase 001: Complete UI Workflow', () => {
  const BASE_URL = 'http://localhost:5173'
  const API_URL = 'http://localhost:8000'

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
  })

  test('complete project workflow: create, navigate, and delete', async ({ page, request }) => {
    // Generate unique project name
    const projectName = `Workflow Test ${Date.now()}`
    
    // 1. CREATE PROJECT
    await test.step('Create new project', async () => {
      // Fill project name
      await page.getByPlaceholder('Project name').fill(projectName)
      
      // Click create button
      await page.getByRole('button', { name: 'Create' }).click()
      
      // Wait for project to appear in list
      await expect(page.locator(`text="${projectName}"`)).toBeVisible({ timeout: 10000 })
      
      // Take screenshot of created project
      await page.screenshot({ 
        path: `test-results/created-project-${Date.now()}.png`,
        fullPage: true 
      })
    })

    // 2. NAVIGATE TO PROJECT
    let projectId: string | undefined
    await test.step('Navigate to project page', async () => {
      // Find the project card and click Open
      const projectCard = page.locator(`text="${projectName}"`).locator('..').locator('..')
      await projectCard.getByRole('button', { name: 'Open' }).click()
      
      // Verify navigation to project page
      await expect(page).toHaveURL(/\/project\/[^/]+/)
      
      // Extract project ID from URL
      const url = page.url()
      projectId = url.split('/project/')[1]
      
      // Verify three panels are visible
      await expect(page.getByTestId('vibecode-panel')).toBeVisible()
      await expect(page.getByTestId('code-panel')).toBeVisible()
      await expect(page.getByTestId('test-panel')).toBeVisible()
      
      // Verify project name is shown
      await expect(page.locator(`text="Project: ${projectName}"`)).toBeVisible()
      
      // Take screenshot of project page
      await page.screenshot({ 
        path: `test-results/project-page-${Date.now()}.png`,
        fullPage: true 
      })
    })

    // 3. TEST DARK MODE TOGGLE
    await test.step('Toggle dark mode', async () => {
      // Enable dark mode
      await page.getByRole('switch', { name: /toggle dark mode/i }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
      
      // Take screenshot in dark mode
      await page.screenshot({ 
        path: `test-results/dark-mode-${Date.now()}.png`,
        fullPage: true 
      })
      
      // Disable dark mode
      await page.getByRole('switch', { name: /toggle dark mode/i }).click()
      await expect(page.locator('html')).not.toHaveClass(/dark/)
    })

    // 4. NAVIGATE BACK TO HOME
    await test.step('Navigate back to home', async () => {
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      // Verify we're back on home page
      await expect(page.locator('h1').filter({ hasText: 'Projects' })).toBeVisible()
      
      // Verify created project is in the list
      await expect(page.locator(`text="${projectName}"`)).toBeVisible()
    })

    // 5. DELETE PROJECT
    await test.step('Delete project', async () => {
      // Find project card and click delete
      const projectCard = page.locator(`text="${projectName}"`).locator('..').locator('..')
      await projectCard.getByRole('button', { name: 'Delete' }).click()
      
      // Wait for project to disappear
      await expect(page.locator(`text="${projectName}"`)).not.toBeVisible({ timeout: 10000 })
      
      // Verify via API that project is deleted
      if (projectId) {
        const response = await request.get(`${API_URL}/projects`)
        const projects = await response.json()
        const deletedProject = projects.find((p: { id: string }) => p.id === projectId)
        expect(deletedProject).toBeUndefined()
      }
    })
  })

  test('verify all UI elements are present and functional', async ({ page }) => {
    // Header elements
    await expect(page.locator('h1').filter({ hasText: 'Vibegrapher' })).toBeVisible()
    await expect(page.locator('text=Dark Mode')).toBeVisible()
    await expect(page.getByRole('switch', { name: /toggle dark mode/i })).toBeVisible()
    
    // Projects page elements
    await expect(page.locator('h1').filter({ hasText: 'Projects' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'Create New Project' })).toBeVisible()
    await expect(page.getByPlaceholder('Project name')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible()
    
    // Check that Open and Delete buttons exist for projects
    const projectCards = page.locator('.bg-card').filter({ has: page.locator('h3') })
    const count = await projectCards.count()
    
    if (count > 0) {
      // Check first project has both buttons
      const firstCard = projectCards.first()
      await expect(firstCard.getByRole('button', { name: 'Open' })).toBeVisible()
      await expect(firstCard.getByRole('button', { name: 'Delete' })).toBeVisible()
    }
  })

  test('create multiple projects rapidly', async ({ page }) => {
    const projectNames = [
      `Rapid Test 1 ${Date.now()}`,
      `Rapid Test 2 ${Date.now()}`,
      `Rapid Test 3 ${Date.now()}`
    ]
    
    for (const name of projectNames) {
      await page.getByPlaceholder('Project name').fill(name)
      await page.getByRole('button', { name: 'Create' }).click()
      
      // Don't wait for each one, just proceed
      await page.waitForTimeout(500)
    }
    
    // Now verify all were created
    for (const name of projectNames) {
      await expect(page.locator(`text="${name}"`)).toBeVisible({ timeout: 10000 })
    }
    
    // Clean up - delete all created projects
    for (const name of projectNames) {
      const projectCard = page.locator(`text="${name}"`).locator('..').locator('..')
      await projectCard.getByRole('button', { name: 'Delete' }).click()
      await page.waitForTimeout(500)
    }
  })
})