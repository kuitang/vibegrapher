/**
 * Test button to simulate diff creation for Phase 007 testing
 */

import { Button } from '@/components/ui/button'
import socketIOService from '@/services/socketio'

export function TestDiffButton({ projectId }: { projectId: string }) {
  const handleTestDiff = () => {
    // Simulate a diff_created event
    const testDiff = {
      diff_id: 'test-diff-' + Date.now(),
      commit_message: 'Test diff for Phase 007',
      session_id: 'test-session-123',
      git_commit: 'abc123'
    }
    
    console.log('[TestDiffButton] Simulating diff created:', testDiff)
    
    // Emit the event through socket.io service
    // This simulates what would happen when backend sends a diff
    socketIOService.send('test_diff', testDiff)
    
    // Also emit it locally for testing
    const event = new CustomEvent('diff_created', { detail: testDiff })
    window.dispatchEvent(event)
  }
  
  return (
    <Button 
      onClick={handleTestDiff}
      variant="outline"
      size="sm"
      className="ml-2"
    >
      Test Diff
    </Button>
  )
}