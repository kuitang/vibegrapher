const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';
const API_URL = process.env.API_URL || 'http://localhost:8000';

// Create evidence directory
const EVIDENCE_DIR = '../validated_test_evidence/phase2';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

test.describe('Phase 2: Frontend Real-time Streaming Tests', () => {
  test('Test 1: Fetch existing conversation messages', async ({ browser }) => {
    console.log('=== TEST 1: Fetch existing conversation ===');
    
    const page = await browser.newPage();
    
    try {
      // Navigate to frontend
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Take initial screenshot
      await page.screenshot({ 
        path: path.join(EVIDENCE_DIR, 'phase2-homepage.png'),
        fullPage: true 
      });
      
      // Look for existing projects with conversations
      console.log('Looking for existing projects...');
      
      const projects = await page.locator('[data-testid="project-card"], .cursor-pointer').all();
      console.log(`Found ${projects.length} clickable elements`);
      
      if (projects.length === 0) {
        console.log('No projects found, creating one...');
        
        // Create new project
        await page.fill('input[placeholder="Project name"]', 'Phase 2 Frontend Test');
        await page.click('button:has-text("Create")');
        await page.waitForURL(/\/project\//);
      } else {
        // Click on first available project
        console.log('Clicking on first project...');
        await projects[0].click();
        await page.waitForURL(/\/project\//);
      }
      
      await page.waitForLoadState('networkidle');
      
      // Take project page screenshot
      await page.screenshot({ 
        path: path.join(EVIDENCE_DIR, 'phase2-project-page.png'),
        fullPage: true 
      });
      
      console.log('Current URL:', page.url());
      
      // Look for existing messages in the conversation
      const messages = await page.locator('[data-testid="message"]').all();
      console.log(`Found ${messages.length} existing messages`);
      
      // Check console for errors
      const consoleLogs = [];
      page.on('console', msg => {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      });
      
      // Wait a bit to capture any console activity
      await page.waitForTimeout(3000);
      
      // Take final screenshot
      await page.screenshot({ 
        path: path.join(EVIDENCE_DIR, 'phase2-messages-loaded.png'),
        fullPage: true 
      });
      
      // Save test results
      const evidence = {
        test: 'Phase 2 Frontend - Message Fetching',
        timestamp: new Date().toISOString(),
        url: page.url(),
        existing_messages_count: messages.length,
        console_logs: consoleLogs.slice(-10), // Last 10 console messages
        projects_found: projects.length,
        success: true
      };
      
      fs.writeFileSync(
        path.join(EVIDENCE_DIR, 'test1-message-fetching.json'),
        JSON.stringify(evidence, null, 2)
      );
      
      console.log('✅ Test 1 completed - Message fetching verified');
      
    } catch (error) {
      console.error('❌ Test 1 failed:', error);
      
      // Save error evidence
      await page.screenshot({ 
        path: path.join(EVIDENCE_DIR, 'phase2-test1-error.png'),
        fullPage: true 
      });
      
      const errorEvidence = {
        test: 'Phase 2 Frontend - Message Fetching',
        timestamp: new Date().toISOString(),
        error: error.message,
        success: false
      };
      
      fs.writeFileSync(
        path.join(EVIDENCE_DIR, 'test1-error.json'),
        JSON.stringify(errorEvidence, null, 2)
      );
      
      throw error;
    } finally {
      await page.close();
    }
  });
  
  test('Test 2: Send message and check real-time streaming', async ({ browser }) => {
    console.log('=== TEST 2: Real-time streaming ===');
    
    const page = await browser.newPage();
    
    try {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Create fresh project for streaming test
      await page.fill('input[placeholder="Project name"]', `Streaming Test ${Date.now()}`);
      await page.click('button:has-text("Create")');
      await page.waitForURL(/\/project\//);
      await page.waitForLoadState('networkidle');
      
      // Take pre-message screenshot
      await page.screenshot({ 
        path: path.join(EVIDENCE_DIR, 'phase2-before-message.png'),
        fullPage: true 
      });
      
      // Count initial messages
      const initialCount = await page.locator('[data-testid="message"]').count();
      console.log(`Initial message count: ${initialCount}`);
      
      // Send a message
      console.log('Sending test message...');
      await page.fill('textarea[placeholder*="Type your message"]', 'Add a comment to the hello function');
      
      await page.screenshot({ 
        path: path.join(EVIDENCE_DIR, 'phase2-message-typed.png'),
        fullPage: true 
      });
      
      await page.click('button[aria-label="Send message"]');
      
      // Take screenshot right after sending
      await page.screenshot({ 
        path: path.join(EVIDENCE_DIR, 'phase2-message-sent.png'),
        fullPage: true 
      });
      
      console.log('Message sent, waiting for real-time updates...');
      
      // Monitor for new messages appearing in real-time
      let messageCount = initialCount;
      let checkCount = 0;
      const maxChecks = 30; // 30 seconds
      
      while (checkCount < maxChecks) {
        await page.waitForTimeout(1000);
        const newCount = await page.locator('[data-testid="message"]').count();
        
        if (newCount > messageCount) {
          console.log(`Messages increased from ${messageCount} to ${newCount}`);
          messageCount = newCount;
          
          // Take screenshot when messages appear
          await page.screenshot({ 
            path: path.join(EVIDENCE_DIR, `phase2-messages-${newCount}.png`),
            fullPage: true 
          });
        }
        
        checkCount++;
      }
      
      const finalCount = await page.locator('[data-testid="message"]').count();
      console.log(`Final message count: ${finalCount}`);
      
      // Take final screenshot
      await page.screenshot({ 
        path: path.join(EVIDENCE_DIR, 'phase2-streaming-complete.png'),
        fullPage: true 
      });
      
      // Verify streaming worked
      const streamingWorked = finalCount > initialCount;
      
      const evidence = {
        test: 'Phase 2 Frontend - Real-time Streaming',
        timestamp: new Date().toISOString(),
        initial_message_count: initialCount,
        final_message_count: finalCount,
        messages_received: finalCount - initialCount,
        streaming_worked: streamingWorked,
        test_duration_seconds: maxChecks,
        success: streamingWorked
      };
      
      fs.writeFileSync(
        path.join(EVIDENCE_DIR, 'test2-streaming.json'),
        JSON.stringify(evidence, null, 2)
      );
      
      if (streamingWorked) {
        console.log('✅ Test 2 SUCCESS - Real-time streaming working!');
      } else {
        console.log('❌ Test 2 FAILED - No real-time messages received');
      }
      
    } catch (error) {
      console.error('❌ Test 2 error:', error);
      throw error;
    } finally {
      await page.close();
    }
  });
});