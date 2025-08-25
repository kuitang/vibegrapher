# Frontend Phase 001: Core Layout with shadcn

## Objectives
Set up React app with TypeScript, shadcn components and basic layout with strict type safety.

## Implementation Tasks
1. Configure TypeScript with strict mode
2. Basic routing (home, project page) with typed routes
3. Zustand store with typed state and actions
4. React Query configuration with typed queries
5. Layout: Left panel (full height) + Right panel (split top/bottom) using shadcn Card
6. Set up shadcn theme and dark mode toggle

## Acceptance Criteria
- ✅ TypeScript strict mode enabled with no errors
- ✅ `npm run typecheck` passes with no errors
- ✅ Home page loads at / with project list
- ✅ Project page at /project/{id} shows correct layout:
  - Left: Vibecode panel (full height)
  - Right top: Code viewer panel
  - Right bottom: Test results panel
- ✅ shadcn Card components used for all three panels
- ✅ Dark mode toggle functional
- ✅ Zustand store initialized with typed empty state
- ✅ React Query provider wraps app with typed hooks
- ✅ All components have proper type annotations

## Integration Tests (Vitest + Testing Library)
```typescript
// tests/integration/phase_001_layout.test.tsx:
// - test three-panel layout with shadcn Cards (verify 3 panels with test IDs)
// - test dark mode toggle functionality
// - test zustand store initialization
```

## E2E Test (Playwright - Headless)
```typescript
// tests/e2e/phase001-layout.e2e.ts:
// - Verify three Card panels visible with test IDs
// - Verify shadcn Card structure (exactly 3 panels)
// - Test dark mode toggle
```

## IMPORTANT: Pre-Development Check
**CRITICAL**: Ensure Playwright MCP server works headless before starting:
```bash
npx playwright test --headed=false
# Must run without browser windows - fix if it doesn't work headless
```

## Validation Requirements  
- Write Vitest + React Testing Library integration tests for layout components
- Write Playwright E2E tests (headless) for full user flows
- **CRITICAL**: Use `npm test -- --run --watchAll=false` to ensure tests exit
- Test TypeScript compilation with `npm run typecheck`  
- Verify shadcn Card components render with proper test IDs
- Test dark mode toggle functionality
- Save test evidence in validated_test_evidence/phase-001/

## Setup Commands
```bash
# Standard Vite + React + TypeScript setup
# Configure TypeScript strict mode in tsconfig.json
# Set up environment files (.env.local, .env.development, .env.production)
# Install: Tailwind, shadcn/ui, zustand, react-query, socket.io-client
# Test deps: vitest, @testing-library/react, @playwright/test
```

## Deliverables
- [ ] tsconfig.json with strict TypeScript configuration
- [ ] Vite config with React + TypeScript
- [ ] shadcn components configured
- [ ] Typed layout components in src/components/layout/
- [ ] Typed Zustand store in src/store/
- [ ] Integration tests in tests/integration/
- [ ] E2E tests in tests/e2e/
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Validation evidence in validated_test_evidence/phase-001/