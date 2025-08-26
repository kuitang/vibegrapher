import { test, expect } from '@playwright/test'

test.describe('Mobile Layout - Simplified', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    
    // Mock API responses
    await page.route('**/api/projects', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-project-1',
            name: 'Test Project',
            created_at: new Date().toISOString(),
            current_branch: 'main'
          }
        ])
      })
    })
    
    await page.route('**/api/projects/test-project-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-project-1',
          name: 'Test Project',
          created_at: new Date().toISOString(),
          current_branch: 'main',
          current_code: '# Test code\nprint("Hello World")'
        })
      })
    })
    
    await page.goto('http://localhost:5174/project/test-project-1')
  })
  
  test('should have removed all unimplemented menu buttons', async ({ page }) => {
    // Check that hamburger menu is gone
    await expect(page.locator('[data-testid="mobile-menu"]')).not.toBeVisible()
    
    // Check that more actions menu is gone  
    await expect(page.locator('[data-testid="more-actions"]')).not.toBeVisible()
    
    // Check that Actions button is gone
    await expect(page.locator('[data-testid="mobile-actions"]')).not.toBeVisible()
    await expect(page.locator('button:has-text("Actions")')).not.toBeVisible()
  })
  
  test('should have header with back button and dark mode toggle', async ({ page }) => {
    const header = page.locator('header')
    await expect(header).toBeVisible()
    
    // Should contain back button
    const backButton = header.locator('a:has-text("<")')
    await expect(backButton).toBeVisible()
    await expect(backButton).toHaveAttribute('href', '/')
    
    // Should contain project name
    await expect(header).toContainText('Test Project')
    
    // Should have dark mode toggle
    const darkModeToggle = header.locator('[role="switch"]')
    await expect(darkModeToggle).toBeVisible()
    
    // Should have sun and moon icons
    await expect(header.locator('svg').first()).toBeVisible() // Sun or Moon icon
  })
  
  test('all tab panels should take full remaining height', async ({ page }) => {
    const viewportHeight = 812
    
    // Test Code tab
    await page.click('button[role="tab"]:has-text("Code")')
    await page.waitForTimeout(100)
    
    const codePanel = page.locator('[data-testid="code-viewer"]')
    await expect(codePanel).toBeVisible()
    
    // Get heights of fixed elements
    const headerHeight = await page.locator('header').evaluate(el => el.getBoundingClientRect().height)
    const tabsHeight = await page.locator('[role="tablist"]').evaluate(el => el.getBoundingClientRect().height) 
    
    // Calculate expected available height (no Actions button now)
    const expectedAvailable = viewportHeight - headerHeight - tabsHeight - 32 // 32px padding
    
    // Monaco editor should have proper height
    const monacoContainer = page.locator('[data-testid="monaco-container"]')
    const monacoHeight = await monacoContainer.evaluate(el => {
      const style = window.getComputedStyle(el)
      return parseInt(style.height)
    })
    
    console.log(`Expected available: ${expectedAvailable}, Monaco height: ${monacoHeight}`)
    expect(monacoHeight).toBeGreaterThan(600) // Should have more space without Actions button
    
    // Test Vibecode tab
    await page.click('button[role="tab"]:has-text("Vibecode")')
    await page.waitForTimeout(100)
    
    const vibecodePanel = page.locator(':has-text("Vibecode Panel")')
    await expect(vibecodePanel).toBeVisible()
    
    // Test Tests tab
    await page.click('button[role="tab"]:has-text("Tests")')  
    await page.waitForTimeout(100)
    
    const testPanel = page.locator(':has-text("Test Results")')
    await expect(testPanel).toBeVisible()
    
    // Test panel should use flex layout to take full height
    const testPanelContainer = testPanel.locator('..').first()
    const testPanelClasses = await testPanelContainer.getAttribute('class')
    expect(testPanelClasses).toContain('h-full')
    expect(testPanelClasses).toContain('flex')
    expect(testPanelClasses).toContain('flex-col')
  })
})