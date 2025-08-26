/**
 * Simple script to test and capture evidence of vibecode messages
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Create evidence directory
const EVIDENCE_DIR = path.join(__dirname, 'vibecode-messages');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.text().includes('[VibecodePanel]') || 
        msg.text().includes('[Socket.io]') ||
        msg.text().includes('message')) {
      console.log('Browser console:', msg.text());
    }
  });

  try {
    // Navigate to haiku project
    console.log('Navigating to project...');
    await page.goto('http://kui-vibes:5173/project/d849869b-71bf-466f-bcf2-01680b2e2abd');
    await page.waitForLoadState('networkidle');
    
    // Screenshot 1: Initial page
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '01-initial-page.png'),
      fullPage: true 
    });
    console.log('✅ Captured: 01-initial-page.png');
    
    // Wait for vibecode panel
    await page.waitForTimeout(3000);
    
    // Screenshot 2: After wait
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '02-after-wait.png'),
      fullPage: true 
    });
    console.log('✅ Captured: 02-after-wait.png');
    
    // Check for session
    const sessionBadge = await page.locator('text=Session Active').isVisible().catch(() => false);
    console.log('Session Active badge visible:', sessionBadge);
    
    // Send a test message
    const textarea = await page.locator('textarea[placeholder*="Type your message"]').first();
    await textarea.fill('Create a simple hello world function');
    
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '03-message-typed.png'),
      fullPage: true 
    });
    console.log('✅ Captured: 03-message-typed.png');
    
    // Click send
    await page.keyboard.press('Enter');
    
    // Wait for response
    console.log('Waiting for response...');
    await page.waitForTimeout(5000);
    
    // Screenshot 4: After sending
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '04-after-send.png'),
      fullPage: true 
    });
    console.log('✅ Captured: 04-after-send.png');
    
    // Check for messages
    const messageContainers = await page.locator('.flex.gap-3').count();
    console.log('Number of message containers found:', messageContainers);
    
    // Check for VibeCoder/Evaluator labels
    const vibecoderVisible = await page.locator('text=VibeCoder').isVisible().catch(() => false);
    const evaluatorVisible = await page.locator('text=Evaluator').isVisible().catch(() => false);
    console.log('VibeCoder label visible:', vibecoderVisible);
    console.log('Evaluator label visible:', evaluatorVisible);
    
    // Check for iteration badges
    const iterationCount = await page.locator('text=/Iteration \\d+/').count();
    console.log('Iteration badges found:', iterationCount);
    
    // Final screenshot
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '05-final-state.png'),
      fullPage: true 
    });
    console.log('✅ Captured: 05-final-state.png');
    
    console.log('\n📁 Evidence saved to:', path.resolve(EVIDENCE_DIR));
    
  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'error-state.png'),
      fullPage: true 
    });
  }
  
  // Keep browser open for manual inspection
  console.log('\n⏸️  Browser will stay open for 30 seconds for inspection...');
  await page.waitForTimeout(30000);
  
  await browser.close();
})();