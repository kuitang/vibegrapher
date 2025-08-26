import { test, expect } from '@playwright/test'

test.describe('Mobile Layout with Real Project', () => {
  test('navigate to actual project and check mobile layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    
    // Go to homepage
    await page.goto('http://localhost:5174/')
    await page.waitForTimeout(1000)
    
    // Click on the first project's Open button
    const firstProjectOpenButton = page.locator('a:has-text("Open")').first()
    const projectHref = await firstProjectOpenButton.getAttribute('href')
    console.log('Project href:', projectHref)
    
    await firstProjectOpenButton.click()
    await page.waitForTimeout(2000)
    
    // Now check for mobile layout elements
    const header = page.locator('header')
    await expect(header).toBeVisible()
    
    // Check for back button
    const backButton = header.locator('a:has-text("<")')
    await expect(backButton).toBeVisible()
    
    // Check for dark mode toggle
    const darkModeToggle = header.locator('[role="switch"]')
    await expect(darkModeToggle).toBeVisible()
    
    // Check for tabs
    const tabs = page.locator('[role="tablist"]')
    await expect(tabs).toBeVisible()
    
    // Check tab buttons exist
    await expect(page.locator('button[role="tab"]:has-text("Vibecode")')).toBeVisible()
    await expect(page.locator('button[role="tab"]:has-text("Code")')).toBeVisible()
    await expect(page.locator('button[role="tab"]:has-text("Tests")')).toBeVisible()
    
    // Click Code tab
    await page.click('button[role="tab"]:has-text("Code")')
    await page.waitForTimeout(500)
    
    // Check that Code panel is visible
    const codeViewer = page.locator('[data-testid="code-viewer"]')
    await expect(codeViewer).toBeVisible()
    
    // Check Monaco editor has proper height
    const monacoContainer = page.locator('[data-testid="monaco-container"]')
    const monacoHeight = await monacoContainer.evaluate(el => {
      const style = window.getComputedStyle(el)
      return parseInt(style.height)
    })
    
    console.log('Monaco height:', monacoHeight)
    expect(monacoHeight).toBeGreaterThan(500) // Should have substantial height
    
    // Take screenshot for verification
    await page.screenshot({ path: 'mobile-project-layout.png' })
  })
})