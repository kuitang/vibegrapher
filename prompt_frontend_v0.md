# Frontend Agent Instructions for Vibegrapher v0

## Your Mission
Build a React TypeScript interface for vibecoding agents via natural language. No graph visualization in v0.

## Environment Setup

### Node Environment (REQUIRED)
```bash
# Use Node 18+ and npm
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build
```

### Environment Configuration
```bash
# .env (never commit this)
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## Project Organization

### Code Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/      # Layout components
│   │   ├── vibecode/    # Vibecode panel components
│   │   ├── code/        # Code viewer components
│   │   └── test/        # Test runner components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API and WebSocket services
│   └── store/           # Zustand state management
├── tests/
│   ├── integration/     # Vitest + Testing Library
│   ├── e2e/            # Playwright (HEADLESS)
│   └── mocks/          # MSW mock servers
└── validated_test_evidence/  # Test artifacts
```

### Testing Strategy (Vitest + Playwright)
- **Integration**: Vitest + React Testing Library + MSW
- **E2E**: Playwright running HEADLESS
- **Mocks**: MSW for API mocking in development/tests
- **Focus**: User flows and component interactions
- **shadcn Testing**: shadcn components are built on Radix UI primitives. Test them by:
  - Using `data-testid` attributes on shadcn component usage
  - Testing by ARIA roles (e.g., `role="dialog"` for Dialog)
  - Using accessible names (e.g., `getByRole('button', { name: /submit/i })`)
  - shadcn doesn't provide test helpers - use standard React Testing Library

### Running Tests
```bash
# IMPORTANT: Always use --watchAll=false for CI/automation
npm test -- --watchAll=false

# Run Vitest tests (headless by default)
npm test -- --run  # Runs once and exits

# Run specific test file
npm test -- --run tests/integration/phase001-layout.test.tsx

# Run E2E tests with Playwright (headless)
npx playwright test

# Run E2E with UI (for debugging only)
npx playwright test --ui

# Generate coverage report
npm run test:coverage
```

## shadcn/ui Setup

### Initial Setup (One-time)
```bash
# Create Vite app
npm create vite@latest frontend -- --template react-ts
cd frontend

# Install and configure Tailwind + shadcn
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn-ui@latest init

# Add ALL required components upfront
npx shadcn-ui@latest add alert alert-dialog avatar badge button
npx shadcn-ui@latest add card collapsible dialog drawer dropdown-menu
npx shadcn-ui@latest add input popover progress scroll-area separator
npx shadcn-ui@latest add sheet sonner table tabs textarea tooltip
```

## Implementation Phases

See `plans/frontend-phase-*.md` for detailed requirements:

1. **Phase 001**: Core Layout → `plans/frontend-phase-001-layout.md`
2. **Phase 002**: WebSocket Setup → `plans/frontend-phase-002-websocket.md`
3. **Phase 003**: Session Management → `plans/frontend-phase-003-session.md`
4. **Phase 004**: Code Viewer → `plans/frontend-phase-004-code-viewer.md`
5. **Phase 005**: Diff Handling → `plans/frontend-phase-005-diff.md`
6. **Phase 006**: Test Runner → `plans/frontend-phase-006-test-runner.md`
7. **Phase 007**: Mobile Responsive → `plans/frontend-phase-007-mobile.md`

## Critical Requirements

### WebSocket Debug Logging
```typescript
// ALWAYS log WebSocket messages
socket.on('connect', () => console.log('[WS] Connected'))
socket.on('vibecode_response', (data) => {
  console.log('[WS] Vibecode:', data, 'trace:', data.trace_id)
})
```

### State Management (Zustand)
```typescript
interface AppState {
  project: Project | null
  currentSession: SessionInfo | null
  messages: Message[]
  
  actions: {
    startSession: (projectId: string, nodeId?: string) => Promise<void>
    sendMessage: (prompt: string) => Promise<void>
    clearSession: () => Promise<void>
  }
}
```

### No Hardcoded URLs
```typescript
// CORRECT
const API_URL = import.meta.env.VITE_API_URL || ''

// WRONG
const API_URL = 'http://localhost:8000'
```

## Quality Checklist

Before EVERY commit:
- [ ] TypeScript type checking passes (`npm run typecheck`)
- [ ] Tests pass (`npm test`)
- [ ] E2E tests pass (`npx playwright test`)
- [ ] No hardcoded URLs
- [ ] All components have proper type annotations
- [ ] Zustand store and actions are fully typed
- [ ] React Query hooks use typed generics
- [ ] WebSocket debug logs working
- [ ] shadcn components used consistently
- [ ] Mobile responsive (375px minimum)
- [ ] All tests run HEADLESS

## Remember
- Use shadcn/ui components everywhere
- Vitest for integration tests (not Jest)
- Playwright runs HEADLESS
- Log ALL WebSocket messages with trace_id
- Mobile-first responsive design
- No graph visualization in v0