/**
 * Regression test for Socket.io connection stability
 * Tests that the socket connection remains stable and doesn't enter infinite reconnection loops
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Evidence directory
const EVIDENCE_DIR = path.join(process.cwd(), '..', 'validated_test_evidence', 'socketio-stability')

test.describe('Socket.io Connection Stability', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    }
  })

  test('socket connection should remain stable without infinite loops', async ({ page }) => {
    // Track console messages for connection/disconnection events
    const connectionEvents: string[] = []
    const disconnectionEvents: string[] = []
    
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('Connected') || text.includes('connected')) {
        connectionEvents.push(`${new Date().toISOString()}: ${text}`)
      }
      if (text.includes('Disconnected') || text.includes('disconnected')) {
        disconnectionEvents.push(`${new Date().toISOString()}: ${text}`)
      }
    })

    // Navigate to project page
    await page.goto('http://kui-vibes:5173/project/d849869b-71bf-466f-bcf2-01680b2e2abd')
    await page.waitForLoadState('networkidle')
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '01-initial-connection.png'),
      fullPage: true 
    })

    // Wait for connection to stabilize (or not)
    await page.waitForTimeout(5000)
    
    // Check connection events
    console.log(`Connection events: ${connectionEvents.length}`)
    console.log(`Disconnection events: ${disconnectionEvents.length}`)
    
    // ASSERTION: Should not have excessive reconnections (more than 3 in 5 seconds indicates a loop)
    expect(connectionEvents.length, 'Too many connection attempts - infinite loop detected').toBeLessThanOrEqual(3)
    expect(disconnectionEvents.length, 'Too many disconnection events - unstable connection').toBeLessThanOrEqual(2)
    
    // Check UI state
    const connectionStatus = await page.locator('text=/Connected|Connecting/').first().textContent()
    console.log(`Connection status in UI: ${connectionStatus}`)
    
    // Take screenshot of connection state
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '02-connection-status.png'),
      fullPage: true 
    })
    
    // ASSERTION: Should show "Connected" not "Connecting..."
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 10000 })
    
    // Test that we can send a message without connection drops
    const textarea = page.locator('textarea[placeholder*="Type your message"]').first()
    await textarea.fill('Test message for connection stability')
    
    // Clear event arrays before sending
    connectionEvents.length = 0
    disconnectionEvents.length = 0
    
    // Send message and wait
    await page.keyboard.press('Enter')
    await page.waitForTimeout(3000)
    
    // ASSERTION: Should not reconnect when sending a message
    expect(disconnectionEvents.length, 'Connection dropped during message send').toBe(0)
    expect(connectionEvents.length, 'Reconnected during message send').toBe(0)
    
    // Take final screenshot
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '03-after-message-send.png'),
      fullPage: true 
    })
    
    // Log summary
    console.log(`
Test Summary:
- Connection remained stable: ${disconnectionEvents.length === 0 ? 'YES' : 'NO'}
- No reconnection loops: ${connectionEvents.length <= 1 ? 'YES' : 'NO'}
- Evidence saved to: ${path.resolve(EVIDENCE_DIR)}
    `)
  })

  test('should handle callback changes without reconnecting', async ({ page }) => {
    const reconnections: string[] = []
    
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('Cleaning up Socket.io connection')) {
        reconnections.push(text)
      }
    })

    // Navigate to project
    await page.goto('http://kui-vibes:5173/project/d849869b-71bf-466f-bcf2-01680b2e2abd')
    await page.waitForLoadState('networkidle')
    
    // Wait for initial connection
    await expect(page.locator('text=Connected')).toBeVisible({ timeout: 10000 })
    
    // Trigger some UI updates that might cause re-renders
    // Click between tabs (this might trigger re-renders with new callbacks)
    await page.click('text=Code')
    await page.waitForTimeout(500)
    await page.click('text=Vibecode')
    await page.waitForTimeout(500)
    await page.click('text=Tests')
    await page.waitForTimeout(500)
    await page.click('text=Vibecode')
    
    // Check that we didn't reconnect during tab switches
    expect(reconnections.length, 'Socket reconnected during tab switches').toBe(0)
    
    // Take evidence screenshot
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '04-stable-after-ui-changes.png'),
      fullPage: true 
    })
    
    console.log('Socket remained stable during UI updates: ', reconnections.length === 0 ? 'PASS' : 'FAIL')
  })
})