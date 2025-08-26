import { test, expect } from '@playwright/test'

test.describe('Mobile Debug', () => {
  test('check if page loads at all', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    
    // Go directly to frontend without mocks
    await page.goto('http://localhost:5174/')
    
    // Check if any content loads
    await page.waitForTimeout(2000)
    const content = await page.content()
    console.log('Page content length:', content.length)
    console.log('Page title:', await page.title())
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'mobile-debug.png' })
    
    // Check if we have any header at all
    const headers = await page.locator('header').count()
    console.log('Number of headers found:', headers)
    
    // Check for any visible text
    const bodyText = await page.locator('body').innerText()
    console.log('Body text (first 500 chars):', bodyText.substring(0, 500))
    
    expect(content.length).toBeGreaterThan(100)
  })
})