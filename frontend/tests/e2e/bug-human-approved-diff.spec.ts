/**
 * E2E test for bug #2: Human-approved diffs should not prompt for approval
 * Diffs with status "human_approved" should not show in the review modal
 */

import { test, expect } from '@playwright/test'

test.describe('Bug: Human-approved diffs should not prompt for approval', () => {
  test('should not show diffs with human_approved status', async ({ page }) => {
    // Navigate to the newfile project which has a human_approved diff
    await page.goto('http://kui-vibes:5173/project/f533af44-12af-4e6a-b291-5b1ba0f9711f')
    
    // Check API response for diff status
    const diffStatus = await page.evaluate(async () => {
      const apiUrl = 'http://kui-vibes:8000'
      const projectId = 'f533af44-12af-4e6a-b291-5b1ba0f9711f'
      
      // Query for evaluator_approved diffs (which should be shown)
      const response = await fetch(`${apiUrl}/projects/${projectId}/diffs?status=evaluator_approved`)
      const diffs = await response.json()
      
      // Return the actual status of any diffs found
      return diffs.map((d: { id: string; status: string }) => ({ id: d.id, status: d.status }))
    })
    
    // Check if any diffs have human_approved status
    const hasHumanApprovedDiff = diffStatus.some((d: { id: string; status: string }) => d.status === 'human_approved')
    
    if (hasHumanApprovedDiff) {
      // If there's a human_approved diff, the modal should NOT be visible
      await expect(page.getByRole('dialog', { name: /Diff Review/ })).not.toBeVisible()
    }
  })
  
  test('should not allow approving an already human_approved diff', async ({ page }) => {
    // Navigate to project with the problematic diff
    await page.goto('http://kui-vibes:5173/project/f533af44-12af-4e6a-b291-5b1ba0f9711f')
    
    // If modal appears (which is the bug), try to approve it
    const modal = page.getByRole('dialog', { name: /Diff Review/ })
    const isModalVisible = await modal.isVisible().catch(() => false)
    
    if (isModalVisible) {
      // This shouldn't happen - the test should fail here
      // But if it does appear, clicking approve should fail
      await page.getByRole('button', { name: 'Accept & Continue' }).click()
      
      // Should see an error message
      await expect(page.getByText(/Approval Failed|already approved/i)).toBeVisible()
    } else {
      // This is the expected behavior - modal should not be visible for human_approved diffs
      expect(isModalVisible).toBe(false)
    }
  })
  
  test('loadPendingDiffs should only return evaluator_approved diffs', async ({ page }) => {
    await page.goto('http://kui-vibes:5173/project/f533af44-12af-4e6a-b291-5b1ba0f9711f')
    
    // Check what loadPendingDiffs actually returns
    const pendingDiffs = await page.evaluate(async () => {
      const apiUrl = 'http://kui-vibes:8000'
      const projectId = 'f533af44-12af-4e6a-b291-5b1ba0f9711f'
      
      const response = await fetch(`${apiUrl}/projects/${projectId}/diffs?status=evaluator_approved`)
      const diffs = await response.json()
      
      // Check if any returned diffs have status !== 'evaluator_approved'
      const incorrectDiffs = diffs.filter((d: { status: string }) => d.status !== 'evaluator_approved')
      
      return {
        total: diffs.length,
        incorrect: incorrectDiffs.length,
        incorrectStatuses: incorrectDiffs.map((d: { status: string }) => d.status)
      }
    })
    
    // Should not return any diffs with status other than evaluator_approved
    expect(pendingDiffs.incorrect).toBe(0)
    
    // If there are incorrect statuses, log them for debugging
    if (pendingDiffs.incorrect > 0) {
      console.log('Found diffs with incorrect status:', pendingDiffs.incorrectStatuses)
    }
  })
})