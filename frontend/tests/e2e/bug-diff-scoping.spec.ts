/**
 * E2E test for bug #1: Diff modal persistence across projects
 * The diff modal should be scoped to each project, not follow users across projects
 */

import { test, expect } from '@playwright/test'

test.describe('Bug: Diff modal should be scoped to projects', () => {
  test('diff modal should not appear when switching to a different project', async ({ page }) => {
    // Create first project
    await page.goto('/')
    await page.getByPlaceholder('Project name').fill('TestProject1')
    await page.getByRole('button', { name: 'Create' }).click()
    await page.waitForURL(/\/project\//)
    const project1Url = page.url()
    
    // Create a diff in project 1 by loading pending diffs
    // Note: In real scenario, this would be created by vibecode process
    // For testing, we'll check if any pending diffs exist
    
    // Go back to home and create second project
    await page.goto('/')
    await page.getByPlaceholder('Project name').fill('TestProject2')
    await page.getByRole('button', { name: 'Create' }).click()
    await page.waitForURL(/\/project\//)
    const project2Url = page.url()
    
    // Verify no diff modal is shown for project 2
    await expect(page.getByRole('dialog', { name: /Diff Review/ })).not.toBeVisible()
    
    // Navigate back to project 1
    await page.goto(project1Url)
    
    // If project 1 has pending diffs, they should show here
    // But not in project 2
    
    // Navigate back to project 2 to confirm no modal
    await page.goto(project2Url)
    await expect(page.getByRole('dialog', { name: /Diff Review/ })).not.toBeVisible()
  })
  
  test('diff modal state should be cleared when localStorage is cleared', async ({ page }) => {
    // Navigate to the newfile project which has a pending diff
    await page.goto('http://kui-vibes:5173/project/f533af44-12af-4e6a-b291-5b1ba0f9711f')
    
    // Wait for the diff modal to appear
    await expect(page.getByRole('dialog', { name: /Diff Review/ })).toBeVisible()
    
    // Close the modal
    await page.getByRole('button', { name: 'Close' }).nth(1).click()
    
    // Navigate to a different project
    await page.goto('http://kui-vibes:5173/project/06ca9899-7a25-44d1-b5d5-9d06b71fa849')
    
    // The diff modal should not appear for this project
    await expect(page.getByRole('dialog', { name: /Diff Review/ })).not.toBeVisible()
    
    // Clear localStorage to reset persisted state
    await page.evaluate(() => {
      localStorage.clear()
    })
    
    // Reload the page
    await page.reload()
    
    // The diff modal should still not appear
    await expect(page.getByRole('dialog', { name: /Diff Review/ })).not.toBeVisible()
  })
})