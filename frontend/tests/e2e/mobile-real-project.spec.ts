import { test, expect } from '@playwright/test'

test.describe('Mobile Layout with Real Project', () => {
  test('navigate to actual project and check mobile layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    
    // Go to homepage
    await page.goto('http://localhost:5174/')
    
    // Wait for projects to load
    await page.waitForSelector('h1:has-text("Projects")', { timeout: 10000 })
    await page.waitForTimeout(1000)
    
    // First create a new project to ensure we have something to test with
    const projectNameInput = page.locator('input[placeholder="Project name"]')
    await projectNameInput.fill('Mobile Test Project')
    
    // For mobile, the create button shows just an icon (Plus)
    const createButton = page.locator('button').filter({ has: page.locator('svg') }).first()
    await createButton.click()
    
    // Wait for navigation to the project page
    await page.waitForURL(/\/project\//, { timeout: 10000 })
    await page.waitForTimeout(1000)
    
    // Now check for mobile layout elements
    const header = page.locator('header')
    await expect(header).toBeVisible()
    
    // Check for back button
    const backButton = header.locator('a:has-text("<")')
    await expect(backButton).toBeVisible()
    await expect(backButton).toHaveAttribute('href', '/')
    
    // Check project name is displayed
    await expect(header).toContainText('Mobile Test Project')
    
    // Check for dark mode toggle
    const darkModeToggle = header.locator('[role="switch"]')
    await expect(darkModeToggle).toBeVisible()
    
    // Check for tabs
    const tabs = page.locator('[role="tablist"]')
    await expect(tabs).toBeVisible()
    
    // Check tab buttons exist
    await expect(page.getByRole('tab', { name: 'Vibecode' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Code', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Tests' })).toBeVisible()
    
    // Check that unimplemented buttons are gone
    await expect(page.locator('[data-testid="mobile-menu"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="more-actions"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="mobile-actions"]')).not.toBeVisible()
    
    // Test Code tab
    await page.getByRole('tab', { name: 'Code', exact: true }).click()
    await page.waitForTimeout(500)
    
    const codeViewer = page.locator('[data-testid="code-viewer"]')
    await expect(codeViewer).toBeVisible()
    
    // Check Monaco editor has proper height
    const monacoContainer = page.locator('[data-testid="monaco-container"]')
    const monacoHeight = await monacoContainer.evaluate(el => {
      const style = window.getComputedStyle(el)
      return parseInt(style.height)
    })
    
    console.log('Monaco height:', monacoHeight)
    expect(monacoHeight).toBeGreaterThan(600) // Should have more space without Actions button
    
    // Test Vibecode tab
    await page.getByRole('tab', { name: 'Vibecode' }).click()
    await page.waitForTimeout(500)
    const vibecodePanel = page.locator('h3:has-text("Vibecode Panel")')
    await expect(vibecodePanel).toBeVisible()
    
    // Test Tests tab
    await page.getByRole('tab', { name: 'Tests' }).click()
    await page.waitForTimeout(500)
    const testPanel = page.locator('h3:has-text("Test Results")')
    await expect(testPanel).toBeVisible()
    
    // Test navigation back to homepage
    await backButton.click()
    await page.waitForURL('http://localhost:5174/')
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible()
    
    // Take screenshot for verification
    await page.screenshot({ path: 'mobile-homepage-return.png' })
  })
})