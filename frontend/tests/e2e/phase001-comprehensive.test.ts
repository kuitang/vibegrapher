import { test, expect } from '@playwright/test'

test.describe('Phase 001: Comprehensive UI Tests', () => {
  const BASE_URL = 'http://localhost:5173'
  const API_URL = 'http://localhost:8000'

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
  })

  test('complete workflow with all features', async ({ page }) => {
    // Generate unique project name with timestamp
    const timestamp = Date.now()
    const projectName = `Test Project ${timestamp}`
    
    // 1. CREATE PROJECT
    await test.step('Create new project', async () => {
      // Clear input and type project name
      const input = page.getByPlaceholder('Project name')
      await input.clear()
      await input.fill(projectName)
      
      // Click create button
      await page.getByRole('button', { name: 'Create' }).click()
      
      // Wait for project to appear in list (should be first since newest first)
      const projectCard = page.locator(`text="${projectName}"`).first()
      await expect(projectCard).toBeVisible({ timeout: 10000 })
      
      // Verify project appears at the top of the list (skip "Create New Project" card)
      const projectCards = page.locator('.bg-card').filter({ hasNot: page.locator('input') })
      const firstProjectName = await projectCards.first().locator('h3').textContent()
      expect(firstProjectName).toBe(projectName)
    })

    // 2. VERIFY PROJECT ORDER
    await test.step('Verify projects ordered newest first', async () => {
      // Create another project
      const secondProjectName = `Second Project ${timestamp}`
      await page.getByPlaceholder('Project name').fill(secondProjectName)
      await page.getByRole('button', { name: 'Create' }).click()
      
      // Wait for second project to appear
      await expect(page.locator(`text="${secondProjectName}"`)).toBeVisible({ timeout: 10000 })
      
      // Verify second project is now first (skip "Create New Project" card)
      const projectCards = page.locator('.bg-card').filter({ hasNot: page.locator('input') })
      const firstProject = await projectCards.first().locator('h3').textContent()
      const secondProject = await projectCards.nth(1).locator('h3').textContent()
      
      expect(firstProject).toBe(secondProjectName)
      expect(secondProject).toBe(projectName)
    })

    // 3. NAVIGATE TO PROJECT
    await test.step('Navigate to project page', async () => {
      // Click Open on the first project (most recent, skip create card)
      const projectCards = page.locator('.bg-card').filter({ hasNot: page.locator('input') })
      const firstProjectCard = projectCards.first()
      await firstProjectCard.getByRole('button', { name: 'Open' }).click()
      
      // Verify navigation to project page
      await expect(page).toHaveURL(/\/project\/[^/]+/)
      
      // Extract project ID from URL
      const url = page.url()
      projectId = url.split('/project/')[1]
      
      // Verify three panels are visible
      await expect(page.getByTestId('vibecode-panel')).toBeVisible()
      await expect(page.getByTestId('code-panel')).toBeVisible()
      await expect(page.getByTestId('test-panel')).toBeVisible()
      
      // Take screenshot of project page
      await page.screenshot({ 
        path: `frontend/validated_test_evidence/phase-001/project-page-${timestamp}.png`,
        fullPage: true 
      })
    })

    // 4. TEST DARK MODE
    await test.step('Test dark mode toggle', async () => {
      // Check initial state
      const htmlElement = page.locator('html')
      const initialDarkClass = await htmlElement.getAttribute('class')
      
      // Toggle dark mode
      await page.getByRole('switch', { name: /toggle dark mode/i }).click()
      
      // Verify class changes
      const afterToggleClass = await htmlElement.getAttribute('class')
      if (initialDarkClass?.includes('dark')) {
        expect(afterToggleClass).not.toContain('dark')
      } else {
        expect(afterToggleClass).toContain('dark')
      }
      
      // Toggle back
      await page.getByRole('switch', { name: /toggle dark mode/i }).click()
      
      // Verify it toggles back
      const finalClass = await htmlElement.getAttribute('class')
      if (initialDarkClass?.includes('dark')) {
        expect(finalClass).toContain('dark')
      } else {
        expect(finalClass).not.toContain('dark')
      }
    })

    // 5. TEST SCROLLING
    await test.step('Test page scrolling', async () => {
      // Go back to home page
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      // Create multiple projects to ensure scrolling
      for (let i = 0; i < 5; i++) {
        const name = `Scroll Test ${timestamp}-${i}`
        await page.getByPlaceholder('Project name').fill(name)
        await page.getByRole('button', { name: 'Create' }).click()
        await page.waitForTimeout(200) // Brief wait between creates
      }
      
      // Check that main element has overflow-auto class
      const mainElement = page.locator('main')
      const mainClass = await mainElement.getAttribute('class')
      expect(mainClass).toContain('overflow-auto')
      
      // Try to scroll
      await page.evaluate(() => {
        const main = document.querySelector('main')
        if (main) {
          main.scrollTop = 100
          return main.scrollTop
        }
        return 0
      })
    })

    // 6. DELETE PROJECTS (Cleanup)
    await test.step('Delete created projects', async () => {
      // Refresh to ensure we have latest state
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Delete projects created in this test
      const testProjects = [
        `Second Project ${timestamp}`,
        projectName,
        ...Array.from({length: 5}, (_, i) => `Scroll Test ${timestamp}-${i}`)
      ]
      
      for (const name of testProjects) {
        const projectCard = page.locator(`.bg-card:has-text("${name}")`)
        const count = await projectCard.count()
        
        if (count > 0) {
          await projectCard.first().getByRole('button', { name: 'Delete' }).click()
          
          // Wait for deletion
          await expect(projectCard.first()).not.toBeVisible({ timeout: 5000 })
        }
      }
    })
  })

  test('verify API integration', async ({ page, request }) => {
    // Check that frontend correctly displays backend data
    const response = await request.get(`${API_URL}/projects`)
    const projects = await response.json()
    
    // Navigate to home page
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    
    // Count projects displayed in UI (exclude "Create New Project" card)
    const projectCards = page.locator('.bg-card').filter({ hasNot: page.locator('input') })
    const uiCount = await projectCards.count()
    
    // API and UI should match
    expect(uiCount).toBe(projects.length)
    
    // Verify first project matches (newest first)
    if (projects.length > 0) {
      const firstApiProject = projects[0]
      const projectCards = page.locator('.bg-card').filter({ hasNot: page.locator('input') })
      const firstUiProjectName = await projectCards.first().locator('h3').textContent()
      expect(firstUiProjectName).toBe(firstApiProject.name)
    }
  })

  test('responsive design check', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    
    // Verify mobile layout
    await expect(page.locator('h1').filter({ hasText: 'Vibegrapher' })).toBeVisible()
    await expect(page.locator('h1').filter({ hasText: 'Projects' })).toBeVisible()
    
    // Create form should still be visible
    await expect(page.getByPlaceholder('Project name')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible()
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Elements should still be visible
    await expect(page.locator('h1').filter({ hasText: 'Projects' })).toBeVisible()
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Elements should still be visible
    await expect(page.locator('h1').filter({ hasText: 'Projects' })).toBeVisible()
  })

  test('error handling and edge cases', async ({ page }) => {
    // Test empty project name
    await page.getByPlaceholder('Project name').fill('')
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Should not create project with empty name
    await page.waitForTimeout(1000)
    // Count actual project cards (excluding create card which always exists)
    const beforeCount = await page.locator('.bg-card').filter({ hasNot: page.locator('input') }).count()
    
    // Try to create empty project again and verify count doesn't increase
    await page.getByPlaceholder('Project name').fill('')
    await page.getByRole('button', { name: 'Create' }).click()
    await page.waitForTimeout(500)
    const afterCount = await page.locator('.bg-card').filter({ hasNot: page.locator('input') }).count()
    expect(afterCount).toBe(beforeCount)
    
    // Test very long project name
    const longName = 'A'.repeat(100)
    await page.getByPlaceholder('Project name').fill(longName)
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Should handle long names gracefully
    await expect(page.locator(`text="${longName}"`)).toBeVisible({ timeout: 10000 })
    
    // Clean up
    const longNameCard = page.locator(`.bg-card:has-text("${longName}")`)
    if (await longNameCard.count() > 0) {
      await longNameCard.first().getByRole('button', { name: 'Delete' }).click()
    }
  })
})