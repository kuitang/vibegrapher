/**
 * Socket.io Fix Validation Test
 * Simple test to validate that our Socket.io connection fix works
 * 
 * This test navigates to a project page and measures the number
 * of Socket.io connections created during normal usage.
 * 
 * Expected: 1-2 connections maximum
 * Before fix: 100+ connections due to callback recreation
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test('validates Socket.io connection fix', async ({ page }) => {
  console.log('Testing Socket.io connection fix...')
  
  // Clear any existing logs to get a clean start
  try {
    fs.writeFileSync('/tmp/backend.log', '')
  } catch {
    // Continue if we can't clear the log
  }
  
  // Navigate to homepage first
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
  
  const startTime = Date.now()
  
  // Navigate to a project page to trigger Socket.io connections
  await page.goto(`${BASE_URL}/project/test-socketio`)
  await page.waitForLoadState('networkidle')
  
  // Wait a bit for any initial connections to stabilize
  await page.waitForTimeout(3000)
  
  // Simulate some basic user interactions that used to cause re-renders
  try {
    // Try to interact with the page in ways that trigger state changes
    await page.mouse.move(100, 100)
    await page.waitForTimeout(500)
    
    // Try clicking on different areas
    await page.mouse.click(200, 200)
    await page.waitForTimeout(500)
    
    await page.mouse.click(300, 300)
    await page.waitForTimeout(500)
    
    // Try pressing some keys
    await page.keyboard.press('Tab')
    await page.waitForTimeout(500)
    
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  } catch (error) {
    console.log('Some interactions failed, continuing...', error.message)
  }
  
  // Wait a total of 10 seconds to capture any delayed connections
  const elapsedTime = Date.now() - startTime
  const remainingTime = Math.max(10000 - elapsedTime, 1000)
  await page.waitForTimeout(remainingTime)
  
  console.log(`Test completed after ${(Date.now() - startTime) / 1000} seconds`)
  
  // Now analyze the backend logs
  let connectionCount = 0
  let disconnectionCount = 0
  
  try {
    const logContent = fs.readFileSync('/tmp/backend.log', 'utf-8')
    const lines = logContent.split('\n')
    
    console.log('Analyzing backend logs...')
    for (const line of lines) {
      if (line.includes('Client connected:')) {
        connectionCount++
        console.log('Connection:', line.match(/Client connected: ([^,]+)/)?.[1])
      }
      if (line.includes('Client disconnected:')) {
        disconnectionCount++
        console.log('Disconnection:', line.match(/Client disconnected: ([^,]+)/)?.[1])
      }
    }
  } catch (error) {
    console.error('Could not read backend log:', error.message)
  }
  
  console.log(`Results: ${connectionCount} connections, ${disconnectionCount} disconnections`)
  
  // Save results for evidence
  const evidence = {
    testName: 'Socket.io Fix Validation',
    timestamp: new Date().toISOString(),
    totalConnections: connectionCount,
    totalDisconnections: disconnectionCount,
    testDuration: '~10 seconds',
    userInteractions: [
      'Page navigation',
      'Mouse movements',
      'Mouse clicks', 
      'Keyboard presses'
    ],
    result: connectionCount <= 3 ? 'PASS - Fix working' : 'FAIL - Still too many connections'
  }
  
  // Ensure evidence directory exists
  const evidenceDir = 'validated_test_evidence/socketio-bug'
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true })
  }
  
  const evidenceFile = `${evidenceDir}/fix-validation-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2))
  
  console.log(`Evidence saved to: ${evidenceFile}`)
  
  // The test passes if we have a reasonable number of connections
  // Before the fix: 100+ connections
  // After the fix: 1-3 connections expected
  expect(connectionCount).toBeLessThanOrEqual(3)
  expect(connectionCount).toBeGreaterThanOrEqual(1) // Should have at least 1 connection
  
  console.log('✅ Socket.io fix validation passed!')
})