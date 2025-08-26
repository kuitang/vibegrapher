import { test, expect } from '@playwright/test'

test.describe('Phase 001: Layout E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/')
  })

  test('should display home page with correct title', async ({ page }) => {
    // Check the page title
    await expect(page.locator('h1')).toContainText('Vibegrapher')
    
    // Check that Projects heading is visible
    await expect(page.locator('h1').filter({ hasText: 'Projects' })).toBeVisible()
  })

  test('should toggle dark mode', async ({ page }) => {
    // Find the dark mode switch
    const darkModeSwitch = page.getByRole('switch', { name: /toggle dark mode/i })
    
    // Initially should be in light mode
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    
    // Click to enable dark mode
    await darkModeSwitch.click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    
    // Click to disable dark mode
    await darkModeSwitch.click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('should create and navigate to a project', async ({ page }) => {
    // Generate a unique project name
    const projectName = `Test Project ${Date.now()}`
    
    // Find and fill the project name input
    await page.getByPlaceholder('Project name').fill(projectName)
    
    // Click create button
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Wait for the project to appear in the list
    await expect(page.locator('text=' + projectName)).toBeVisible({ timeout: 10000 })
    
    // Click open button for the project
    await page.getByRole('button', { name: 'Open' }).first().click()
    
    // Should navigate to project page
    await expect(page).toHaveURL(/\/project\/[^/]+/)
    
    // Verify three panels are visible
    await expect(page.getByTestId('vibecode-panel')).toBeVisible()
    await expect(page.getByTestId('code-panel')).toBeVisible()
    await expect(page.getByTestId('test-panel')).toBeVisible()
  })

  test('should verify three Card panels with correct test IDs', async ({ page }) => {
    // Create a test project first
    const projectName = `Layout Test ${Date.now()}`
    await page.getByPlaceholder('Project name').fill(projectName)
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.locator('text=' + projectName)).toBeVisible({ timeout: 10000 })
    
    // Navigate to project
    await page.getByRole('button', { name: 'Open' }).first().click()
    await expect(page).toHaveURL(/\/project\/[^/]+/)
    
    // Check all three panels exist
    const vibecodePanel = page.getByTestId('vibecode-panel')
    const codePanel = page.getByTestId('code-panel')
    const testPanel = page.getByTestId('test-panel')
    
    await expect(vibecodePanel).toBeVisible()
    await expect(codePanel).toBeVisible()
    await expect(testPanel).toBeVisible()
    
    // Verify they have Card class (bg-card)
    await expect(vibecodePanel).toHaveClass(/bg-card/)
    await expect(codePanel).toHaveClass(/bg-card/)
    await expect(testPanel).toHaveClass(/bg-card/)
    
    // Count total Card elements (should be exactly 3)
    const cards = page.locator('.bg-card')
    await expect(cards).toHaveCount(3)
  })

  test('should persist dark mode across navigation', async ({ page }) => {
    // Enable dark mode on home page
    await page.getByRole('switch', { name: /toggle dark mode/i }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    
    // Create and navigate to a project
    const projectName = `Dark Mode Test ${Date.now()}`
    await page.getByPlaceholder('Project name').fill(projectName)
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.locator('text=' + projectName)).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Open' }).first().click()
    
    // Dark mode should still be enabled
    await expect(page.locator('html')).toHaveClass(/dark/)
    
    // Navigate back
    await page.goBack()
    
    // Dark mode should still be enabled
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})