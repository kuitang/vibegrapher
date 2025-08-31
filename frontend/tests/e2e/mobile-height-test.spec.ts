import { test, expect } from '@playwright/test'

test.describe('Mobile Height Calculations', () => {
  test('should properly size Monaco editor on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    
    // Go to homepage
    await page.goto('http://localhost:5174/')
    
    // Wait for projects to load and create a new project
    await page.waitForSelector('h1:has-text("Projects")', { timeout: 10000 })
    const projectNameInput = page.locator('input[placeholder="Project name"]')
    await projectNameInput.fill('Height Test Project')
    
    // Click create button (icon on mobile)
    const createButton = page.locator('button').filter({ has: page.locator('svg') }).first()
    await createButton.click()
    
    // Wait for navigation to the project page
    await page.waitForURL(/\/project\//, { timeout: 10000 })
    await page.waitForTimeout(1000)
    
    // Click on Code tab
    await page.getByRole('tab', { name: 'Code', exact: true }).click()
    await page.waitForTimeout(1000) // Wait for Monaco to initialize
    
    // Check that the page takes full viewport height
    const heightCheck = await page.evaluate(() => {
      const viewport = window.innerHeight
      const html = document.documentElement
      const body = document.body
      const root = document.querySelector('#root')
      const monacoContainer = document.querySelector('[data-testid="monaco-container"]')
      const editorElement = document.querySelector('.monaco-editor')
      
      return {
        viewport,
        html: {
          height: html.getBoundingClientRect().height,
          computedHeight: window.getComputedStyle(html).height,
          scrollHeight: html.scrollHeight
        },
        body: {
          height: body.getBoundingClientRect().height,
          computedHeight: window.getComputedStyle(body).height,
          scrollHeight: body.scrollHeight
        },
        root: {
          height: root?.getBoundingClientRect().height,
          computedHeight: root ? window.getComputedStyle(root).height : null
        },
        monacoContainer: {
          exists: !!monacoContainer,
          height: monacoContainer?.getBoundingClientRect().height
        },
        editor: {
          exists: !!editorElement,
          height: editorElement?.getBoundingClientRect().height
        },
        hasVerticalScroll: html.scrollHeight > viewport
      }
    })
    
    // Verify full viewport height is used
    expect(heightCheck.html.height).toBe(heightCheck.viewport)
    expect(heightCheck.body.height).toBe(heightCheck.viewport)
    expect(heightCheck.root.height).toBe(heightCheck.viewport)
    
    // Verify no vertical scroll
    expect(heightCheck.hasVerticalScroll).toBe(false)
    
    // Verify Monaco editor exists and has proper height (should be > 500px on 812px viewport)
    expect(heightCheck.monacoContainer.exists).toBe(true)
    expect(heightCheck.editor.exists).toBe(true)
    expect(heightCheck.monacoContainer.height).toBeGreaterThan(500)
    expect(heightCheck.editor.height).toBeGreaterThan(500)
    
    console.log('Height check results:', heightCheck)
  })
  
  test('should resize properly when viewport changes', async ({ page }) => {
    // Start with mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    
    // Navigate to a project
    await page.goto('http://localhost:5174/')
    await page.waitForSelector('h1:has-text("Projects")', { timeout: 10000 })
    
    const projectNameInput = page.locator('input[placeholder="Project name"]')
    await projectNameInput.fill('Resize Test Project')
    
    const createButton = page.locator('button').filter({ has: page.locator('svg') }).first()
    await createButton.click()
    
    await page.waitForURL(/\/project\//, { timeout: 10000 })
    await page.waitForTimeout(1000)
    
    // Switch to Code tab
    await page.getByRole('tab', { name: 'Code', exact: true }).click()
    await page.waitForTimeout(1000)
    
    // Get initial height
    const initialHeight = await page.evaluate(() => {
      const editor = document.querySelector('.monaco-editor')
      return editor?.getBoundingClientRect().height || 0
    })
    
    expect(initialHeight).toBeGreaterThan(500)
    
    // Change viewport size
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE size
    await page.waitForTimeout(500) // Wait for resize handler
    
    // Get new height
    const newHeight = await page.evaluate(() => {
      const editor = document.querySelector('.monaco-editor')
      return editor?.getBoundingClientRect().height || 0
    })
    
    // Should be smaller but still reasonable
    expect(newHeight).toBeGreaterThan(400)
    expect(newHeight).toBeLessThan(initialHeight)
    
    // Verify no scroll after resize
    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight
    })
    expect(hasScroll).toBe(false)
  })
})