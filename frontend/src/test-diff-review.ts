/**
 * Test function to trigger diff review modal
 * Run in browser console: window.testDiffReview()
 */

import type { Diff } from './store/types'

export function testDiffReview() {
  const store = window.__appStore
  if (!store) {
    console.error('Store not available. Make sure to expose it in main.tsx')
    return
  }
  
  const actions = store.getState().actions
  
  // Create a test diff matching the Diff type
  const testDiff: Diff = {
    id: 'test-diff-001',
    project_id: 'test-project',
    session_id: 'test-session',
    base_commit: 'abc123def456',
    target_branch: 'main',
    vibecoder_prompt: 'Add error handling to the user authentication function',
    diff_content: `--- a/auth.py
+++ b/auth.py
@@ -10,6 +10,8 @@ def authenticate_user(username, password):
     """Authenticate user with username and password"""
+    if not username or not password:
+        raise ValueError("Username and password required")
     
     user = User.query.filter_by(username=username).first()
     if not user:
-        return None
+        raise AuthenticationError("User not found")
     
     if not user.check_password(password):
-        return None
+        raise AuthenticationError("Invalid password")
     
     return user`,
    commit_message: 'feat: Add proper error handling to authentication\n\nImprove error messages and validation for user authentication',
    status: 'evaluator_approved' as const,
    evaluator_reasoning: 'This diff improves the authentication function by:\n1. Adding input validation for username and password\n2. Replacing None returns with descriptive exceptions\n3. Making debugging easier with specific error messages\n\nThe changes follow best practices for error handling.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    human_feedback: undefined,
    test_results: undefined,
    tests_run_at: undefined,
    committed_sha: undefined
  }
  
  // Set the diff and show the review modal
  actions.setCurrentReviewDiff(testDiff)
  actions.setShowDiffReviewModal(true)
  
  console.log('Diff review modal should now be visible')
}

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.testDiffReview = testDiffReview
}