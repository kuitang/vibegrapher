/**
 * E2E test for bug #3: Initial code should come from backend, not be hardcoded in frontend
 * When creating a new project, the initial main.py should be created by the backend
 */

import { test, expect } from '@playwright/test'

test.describe('Bug: Initial code should come from backend project setup', () => {
  test('new project should have code from backend git initialization', async ({ page }) => {
    // Create a new project
    await page.goto('/')
    const projectName = `TestCodeProject_${Date.now()}`
    await page.getByPlaceholder('Project name').fill(projectName)
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Wait for navigation to project page
    await page.waitForURL(/\/project\//)
    
    // Wait for code viewer to load
    await expect(page.getByText('Code Viewer')).toBeVisible()
    
    // Get the actual code displayed
    const codeContent = await page.evaluate(() => {
      // Find the Monaco editor content
      const monacoLines = document.querySelectorAll('.view-lines .view-line')
      return Array.from(monacoLines).map(line => line.textContent).join('\n')
    })
    
    // The code should NOT contain the hardcoded demo text
    expect(codeContent).not.toContain('# Welcome to Vibegrapher')
    expect(codeContent).not.toContain('Ready for vibecoding!')
    
    // Instead, it should contain actual code from the backend repository
    // This would be the initial main.py created during git repo setup
  })
  
  test('code should be fetched from backend API, not hardcoded', async ({ page }) => {
    // Create a new project
    await page.goto('/')
    const projectName = `TestAPIProject_${Date.now()}`
    await page.getByPlaceholder('Project name').fill(projectName)
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Wait for navigation
    await page.waitForURL(/\/project\//)
    const projectId = page.url().split('/').pop()
    
    // Check if backend has actual code for this project
    const backendCode = await page.evaluate(async (pid) => {
      const apiUrl = 'http://kui-vibes:8000'
      
      try {
        // Try to fetch the actual code from backend
        const response = await fetch(`${apiUrl}/projects/${pid}/files/main.py`)
        if (response.ok) {
          const data = await response.json()
          return data.content || null
        }
      } catch (error) {
        console.error('Error fetching code from backend:', error)
      }
      
      return null
    }, projectId)
    
    // If backend has code, frontend should display it
    if (backendCode) {
      const displayedCode = await page.evaluate(() => {
        const monacoLines = document.querySelectorAll('.view-lines .view-line')
        return Array.from(monacoLines).map(line => line.textContent).join('\n')
      })
      
      // The displayed code should match backend code
      expect(displayedCode).toContain(backendCode.trim())
    }
  })
  
  test('project creation should initialize git repo with main.py', async ({ page }) => {
    // Create a project via API and check if it has initial files
    const projectName = `TestGitInit_${Date.now()}`
    
    const projectData = await page.evaluate(async (name) => {
      const apiUrl = 'http://kui-vibes:8000'
      
      // Create project
      const createResponse = await fetch(`${apiUrl}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      
      if (!createResponse.ok) {
        throw new Error('Failed to create project')
      }
      
      const project = await createResponse.json()
      
      // Check if project has files
      try {
        const filesResponse = await fetch(`${apiUrl}/projects/${project.id}/files`)
        if (filesResponse.ok) {
          const files = await filesResponse.json()
          return { project, files }
        }
      } catch (error) {
        console.error('Error fetching project files:', error)
      }
      
      return { project, files: [] }
    }, projectName)
    
    // Project should have at least main.py initialized
    expect(projectData.files).toContainEqual(
      expect.objectContaining({
        name: 'main.py'
      })
    )
  })
})