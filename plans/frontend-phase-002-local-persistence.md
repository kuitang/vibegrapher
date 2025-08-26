# Frontend Phase 002: Local State Persistence

## ⚠️ BACKEND DEPENDENCY CHECK
**REQUIRED**: None - this is a frontend-only feature using localStorage.
**PREREQUISITE**: Frontend Phase 001 (Layout) must be completed to have Zustand store.

## Objectives
Implement client-side state persistence using Zustand's built-in persist middleware to protect against data loss from page refreshes, browser crashes, and mobile app backgrounding.

## Implementation Tasks
1. Configure Zustand persist middleware with localStorage
2. Implement selective state persistence (partialize)
3. Add hydration handling for smooth recovery
4. Implement draft message autosave with 500ms debounce
5. Add stale state cleanup (24-hour expiry)

## Key Decisions

### Persisted State (UPDATED per spec_frontend_v0.md)
```typescript
// Selective persistence to avoid stale data issues
// Persisted fields (survive page refresh):
// - currentSession (session metadata only)
// - currentReviewDiff (for modal recovery)
// - pendingDiffIds (IDs only, refetch full objects)
// - draftMessage (prevent data loss)
// - lastActiveTime (for stale detection)
// - approvalMode (user preference)
```

### What NOT to Persist
- project (always fresh from server)
- messages (refetch from SQLiteSession on backend)
- pendingDiffs (full objects - use IDs to refetch)
- Test results (ephemeral, re-run if needed)
- Token usage (already in backend)

## Storage Strategy

### Store Configuration
```typescript
// Use Zustand's persist middleware with:
// - name: 'vibegrapher-state'
// - storage: localStorage (synchronous)
// - partialize: function to select fields
// - version: 1 (for future migrations)
// - merge: custom logic to clear >24h old state
```

### Recovery Flow
```
1. Check localStorage for state
2. Hydrate store (synchronous with localStorage)
3. Validate session with server
4. Re-open modals if they were open
5. Clear if lastActiveTime > 24 hours old
```

## Mobile Considerations
- Instant recovery after app backgrounding
- No network calls needed for UI restoration
- Draft messages never lost
- Works offline (localStorage doesn't need internet)

## Testing Strategy
```typescript
// Test persistence across "page refresh"
// Test stale state cleanup
// Test draft message recovery
// Test modal state restoration
// Test logout clears persisted state
```

## Limitations (Acceptable for v0)
- No cross-device sync (device-specific)
- No cross-browser sync (browser-specific)
- 5MB localStorage limit (sufficient for UI state)
- No server backup (lost if localStorage cleared)

## Future Migration Path
When ready for server persistence:
1. Change storage adapter to hybrid (localStorage + API)
2. Add sync status indicators
3. Implement conflict resolution
4. Components remain unchanged

## Success Metrics
- Zero data loss from page refreshes
- <100ms recovery time (localStorage is synchronous)
- Draft messages always preserved
- Modal states correctly restored

## Dependencies
- zustand (already installed)
- No additional packages needed

## Error Handling
- Graceful fallback if localStorage unavailable
- Clear corrupted state on parse errors
- Log persistence failures but don't block UI

## Security Considerations
- No sensitive data in localStorage
- Clear state on logout
- Validate restored session with server
- Sanitize restored draft messages

## Integration Tests (Vitest)
```typescript
// tests/integration/phase002-persistence.test.tsx
describe('Phase 002: Local Persistence', () => {
  test('stale state cleanup after 24 hours', () => {
    // Set state with old timestamp (25 hours ago)
    // Initialize store - should clear stale state
  })
  
  test('graceful fallback when localStorage unavailable', () => {
    // Mock localStorage to throw "Quota exceeded" error
    // Verify store operations don't crash
  })
})
```

## Validation Script
```bash
OUTPUT_DIR="frontend/validated_test_evidence/phase-002"
npm test -- --run tests/integration/phase002-persistence.test.tsx > $OUTPUT_DIR/vitest.log 2>&1
echo "Phase 002 validation complete"
```

## Deliverables
- [ ] Zustand persist configuration in src/store/vibeStore.ts
- [ ] Hydration error handling
- [ ] Draft message debounced autosave
- [ ] Stale state cleanup logic
- [ ] Integration tests
- [ ] Validation evidence in frontend/validated_test_evidence/phase-002/

## Estimated Time
- 2 days implementation
- 1 day testing
- Total: 3 days