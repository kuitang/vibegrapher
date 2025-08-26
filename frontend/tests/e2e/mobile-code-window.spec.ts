/**
 * Test for mobile code window display issues
 * Ensures code panel is properly visible and usable on mobile devices
 */

import { test, expect } from '@playwright/test'

test.describe('Mobile Code Window Display', () => {
  test.use({
    viewport: { width: 375, height: 812 }, // iPhone 12 Pro dimensions
  })

  test('code window should be visible and functional on mobile', async ({ page }) => {
    // Navigate to a project
    await page.goto('http://kui-vibes:5173/project/99732626-5987-4eef-8fcf-916e82655986')
    
    // Wait for project to load
    await page.waitForSelector('text=TestDiffProject2', { timeout: 10000 })
    
    // Close any modal that might be open
    const closeButton = page.getByRole('button', { name: 'Close' }).first()
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }
    
    // Click on Code tab using the correct selector
    await page.getByRole('tab', { name: 'Code' }).click()
    
    // Wait for Monaco editor to be visible
    await page.waitForSelector('.monaco-editor', { state: 'visible', timeout: 10000 })
    
    // Check that Monaco editor is present and visible
    const codeEditor = await page.locator('.monaco-editor').first()
    await expect(codeEditor).toBeVisible({ timeout: 5000 })
    
    // Check that the editor has content
    const editorContent = await page.locator('.view-lines').first()
    await expect(editorContent).toBeVisible()
    
    // Verify the editor is not cut off (has reasonable height)
    const editorBox = await codeEditor.boundingBox()
    expect(editorBox).not.toBeNull()
    if (editorBox) {
      // Editor should have at least 200px height on mobile
      expect(editorBox.height).toBeGreaterThan(200)
      // Editor should fit within viewport width
      expect(editorBox.width).toBeLessThanOrEqual(375)
    }
  })
  
  test('tabs should switch properly on mobile', async ({ page }) => {
    await page.goto('http://kui-vibes:5173/project/99732626-5987-4eef-8fcf-916e82655986')
    await page.waitForSelector('text=TestDiffProject2', { timeout: 10000 })
    
    // Close any modal that might be open
    const closeButton = page.getByRole('button', { name: 'Close' }).first()
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }
    
    // Check Vibecode tab is selected by default
    const vibecodeTab = page.getByRole('tab', { name: 'Vibecode' })
    await expect(vibecodeTab).toHaveAttribute('aria-selected', 'true')
    
    // Switch to Code tab
    const codeTab = page.getByRole('tab', { name: 'Code' })
    await codeTab.click()
    await expect(codeTab).toHaveAttribute('aria-selected', 'true')
    
    // Verify Code panel is visible by checking for Monaco editor
    await page.waitForSelector('.monaco-editor', { state: 'visible' })
    const codeEditor = page.locator('.monaco-editor').first()
    await expect(codeEditor).toBeVisible()
    
    // Switch to Tests tab
    const testsTab = page.getByRole('tab', { name: 'Tests' })
    await testsTab.click()
    await expect(testsTab).toHaveAttribute('aria-selected', 'true')
    
    // Verify Tests panel is visible
    const testsPanel = page.locator('[role="tabpanel"]').filter({ hasText: 'Test' })
    await expect(testsPanel).toBeVisible()
  })
  
  test('mobile actions menu should be accessible', async ({ page }) => {
    await page.goto('http://kui-vibes:5173/project/99732626-5987-4eef-8fcf-916e82655986')
    await page.waitForSelector('text=TestDiffProject2', { timeout: 10000 })
    
    // Actions button should be visible on mobile
    const actionsButton = page.getByRole('button', { name: 'Actions' })
    await expect(actionsButton).toBeVisible()
    
    // Click actions button
    await actionsButton.click()
    
    // Check that menu opens (adjust selector based on actual implementation)
    const menu = page.locator('[role="menu"]')
    await expect(menu).toBeVisible({ timeout: 2000 })
  })
  
  test('code editor should not overflow on mobile', async ({ page }) => {
    await page.goto('http://kui-vibes:5173/project/99732626-5987-4eef-8fcf-916e82655986')
    await page.waitForSelector('text=TestDiffProject2', { timeout: 10000 })
    
    // Switch to Code tab
    await page.getByRole('tab', { name: 'Code' }).click()
    
    // Wait for editor to load
    await page.waitForSelector('.monaco-editor', { state: 'visible' })
    
    // Check that no horizontal scrollbar is present on the page body
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasHorizontalScroll).toBe(false)
    
    // Check that the editor container doesn't overflow
    const editorContainer = page.locator('.monaco-editor').first()
    const containerBox = await editorContainer.boundingBox()
    if (containerBox) {
      // Should not exceed viewport width
      expect(containerBox.x + containerBox.width).toBeLessThanOrEqual(375)
    }
  })
})