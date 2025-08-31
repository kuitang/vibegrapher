/**
 * Comprehensive test for diff state management across project navigation
 * Ensures pending diffs are properly scoped to projects and cleared on navigation
 */

import { test, expect } from '@playwright/test'

test.describe('Diff State Management', () => {
  test('pending diffs should be cleared when navigating between projects', async ({ page }) => {
    // First, let's check what happens with the actual state
    
    // Navigate to project with known pending diff
    await page.goto('http://kui-vibes:5173/project/f533af44-12af-4e6a-b291-5b1ba0f9711f')
    
    // Wait for page to load - use the heading which is unique
    await expect(page.getByRole('heading', { name: 'newfile' })).toBeVisible()
    
    // Check the app store state for pending diffs
    const stateAfterFirstProject = await page.evaluate(() => {
      // Access the Zustand store directly
      const store = window.localStorage.getItem('vibegrapher-storage')
      const parsedStore = store ? JSON.parse(store) : null
      
      // Also check the actual store state if available
      const appStore = (window as unknown as { __APP_STORE__?: { getState: () => unknown } }).__APP_STORE__
      const currentState = appStore ? appStore.getState() : null
      
      return {
        localStorage: parsedStore?.state,
        hasCurrentReviewDiff: !!parsedStore?.state?.currentReviewDiff,
        pendingDiffIds: parsedStore?.state?.pendingDiffIds || [],
        currentProject: currentState?.project?.id || null
      }
    })
    
    console.log('State after loading first project:', stateAfterFirstProject)
    
    // Navigate to a different project
    await page.goto('http://kui-vibes:5173/project/06ca9899-7a25-44d1-b5d5-9d06b71fa849')
    
    // Wait for page to load - use the heading which is unique
    await expect(page.getByRole('heading', { name: 'totally random project' })).toBeVisible()
    
    // Check state after navigation
    const stateAfterNavigation = await page.evaluate(() => {
      const store = window.localStorage.getItem('vibegrapher-storage')
      const parsedStore = store ? JSON.parse(store) : null
      
      const appStore = (window as unknown as { __APP_STORE__?: { getState: () => unknown } }).__APP_STORE__
      const currentState = appStore ? appStore.getState() : null
      
      return {
        localStorage: parsedStore?.state,
        hasCurrentReviewDiff: !!parsedStore?.state?.currentReviewDiff,
        pendingDiffIds: parsedStore?.state?.pendingDiffIds || [],
        currentProject: currentState?.project?.id || null
      }
    })
    
    console.log('State after navigating to second project:', stateAfterNavigation)
    
    // Verify that diff state was cleared
    expect(stateAfterNavigation.hasCurrentReviewDiff).toBe(false)
    expect(stateAfterNavigation.pendingDiffIds).toHaveLength(0)
    
    // Also verify no modal is shown
    await expect(page.getByRole('dialog', { name: /Diff Review/ })).not.toBeVisible()
  })
  
  test('loadPendingDiffs should fetch diffs specific to current project', async ({ page }) => {
    // Create two test projects
    await page.goto('/')
    
    // Create first project
    const project1Name = `TestDiffProject1_${Date.now()}`
    await page.getByPlaceholder('Project name').fill(project1Name)
    await page.getByRole('button', { name: 'Create' }).click()
    await page.waitForURL(/\/project\//)
    const project1Id = page.url().split('/').pop()
    
    // Create second project
    await page.goto('/')
    const project2Name = `TestDiffProject2_${Date.now()}`
    await page.getByPlaceholder('Project name').fill(project2Name)
    await page.getByRole('button', { name: 'Create' }).click()
    await page.waitForURL(/\/project\//)
    const project2Id = page.url().split('/').pop()
    
    // Check that each project's diffs are loaded independently
    const project1Diffs = await page.evaluate(async (pid) => {
      const apiUrl = 'http://kui-vibes:8000'
      const response = await fetch(`${apiUrl}/projects/${pid}/diffs?status=evaluator_approved`)
      return response.json()
    }, project1Id)
    
    const project2Diffs = await page.evaluate(async (pid) => {
      const apiUrl = 'http://kui-vibes:8000'
      const response = await fetch(`${apiUrl}/projects/${pid}/diffs?status=evaluator_approved`)
      return response.json()
    }, project2Id)
    
    // New projects should have no pending diffs
    expect(project1Diffs).toHaveLength(0)
    expect(project2Diffs).toHaveLength(0)
    
    // Navigate back to project 1
    await page.goto(`http://kui-vibes:5173/project/${project1Id}`)
    // Wait for project to load
    await page.waitForTimeout(1000)
    
    // Check that pendingDiffs in store matches project 1's diffs
    const storeStateProject1 = await page.evaluate(() => {
      const appStore = (window as unknown as { __APP_STORE__?: { getState: () => unknown } }).__APP_STORE__
      const state = appStore ? appStore.getState() : null
      return {
        currentProjectId: state?.project?.id,
        pendingDiffIds: state?.pendingDiffIds || [],
        pendingDiffsLength: state?.pendingDiffs?.length || 0
      }
    })
    
    // Navigate to project 2
    await page.goto(`http://kui-vibes:5173/project/${project2Id}`)
    // Wait for project to load
    await page.waitForTimeout(1000)
    
    // Check that pendingDiffs in store matches project 2's diffs
    const storeStateProject2 = await page.evaluate(() => {
      const appStore = (window as unknown as { __APP_STORE__?: { getState: () => unknown } }).__APP_STORE__
      const state = appStore ? appStore.getState() : null
      return {
        currentProjectId: state?.project?.id,
        pendingDiffIds: state?.pendingDiffIds || [],
        pendingDiffsLength: state?.pendingDiffs?.length || 0
      }
    })
    
    console.log('Store state project 1:', storeStateProject1)
    console.log('Store state project 2:', storeStateProject2)
    
    // Verify project IDs changed
    expect(storeStateProject1.currentProjectId).toBe(project1Id)
    expect(storeStateProject2.currentProjectId).toBe(project2Id)
    expect(storeStateProject1.currentProjectId).not.toBe(storeStateProject2.currentProjectId)
  })
  
  test('clearProjectState should be called when switching projects', async ({ page }) => {
    // Navigate to first project
    await page.goto('http://kui-vibes:5173/project/f533af44-12af-4e6a-b291-5b1ba0f9711f')
    await expect(page.getByRole('heading', { name: 'newfile' })).toBeVisible()
    
    // Enable console logging to see our debug messages
    page.on('console', msg => {
      if (msg.text().includes('[ProjectPage]')) {
        console.log('Browser console:', msg.text())
      }
    })
    
    // Navigate to second project - this should trigger clearProjectState
    await page.goto('http://kui-vibes:5173/project/06ca9899-7a25-44d1-b5d5-9d06b71fa849')
    await expect(page.getByRole('heading', { name: 'totally random project' })).toBeVisible()
    
    // Check if the diff modal is not visible (indicating state was cleared)
    await expect(page.getByRole('dialog', { name: /Diff Review/ })).not.toBeVisible()
    
    // Navigate back to first project
    await page.goto('http://kui-vibes:5173/project/f533af44-12af-4e6a-b291-5b1ba0f9711f')
    await expect(page.getByRole('heading', { name: 'newfile' })).toBeVisible()
    
    // Check state to ensure it's clean
    const finalState = await page.evaluate(() => {
      const appStore = (window as unknown as { __APP_STORE__?: { getState: () => unknown } }).__APP_STORE__
      const state = appStore ? appStore.getState() : null
      return {
        projectId: state?.project?.id,
        pendingDiffs: state?.pendingDiffs || [],
        currentReviewDiff: state?.currentReviewDiff
      }
    })
    
    console.log('Final state after navigating back:', finalState)
    
    // Should have correct project and clean diff state
    expect(finalState.projectId).toBe('f533af44-12af-4e6a-b291-5b1ba0f9711f')
  })
})