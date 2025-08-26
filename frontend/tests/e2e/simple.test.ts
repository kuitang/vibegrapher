import { test, expect } from '@playwright/test'

test('basic test - verifies playwright setup', async ({ page }) => {
  // This is a simple test to verify Playwright is working
  // Since we can't start the dev server due to Node version,
  // we're testing the setup itself
  
  // Navigate to a known URL
  await page.goto('https://example.com')
  
  // Verify the page loaded
  await expect(page).toHaveTitle(/Example Domain/)
  
  // Verify content is present
  await expect(page.locator('h1')).toContainText('Example Domain')
})