# Frontend Agent Instructions for Vibegrapher v0

## Your Mission
Build a React TypeScript interface for vibecoding agents via natural language with human review UI for approving/rejecting code changes. No graph visualization in v0.

**Note: For detailed technical specifications, component interfaces, and architecture details, see `spec_frontend_v0.md`**

## Environment Setup

### Node Environment (REQUIRED)
```bash
# IMPORTANT: Work from PROJECT ROOT, use --prefix frontend for npm commands

# Check Node version
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher

# Install frontend dependencies (from project root)
npm --prefix frontend install

# PREREQUISITE: Check backend is running before starting frontend
curl http://localhost:8000/projects || { echo "Backend not running! Start it first."; exit 1; }

# Start development server (from project root)
npm --prefix frontend run dev

# Build for production (from project root)
npm --prefix frontend run build
```

### Environment Configuration
```bash
# .env.local (NEVER commit this file - add to .gitignore) - for LOCAL development
VITE_API_URL=http://localhost:8000
VITE_WS_URL=http://localhost:8000

# .env.development (for REMOTE development server access)
VITE_API_URL=http://YOUR_DEV_SERVER_IP:8000
VITE_WS_URL=http://YOUR_DEV_SERVER_IP:8000

# .env.production (for production deployment)
VITE_API_URL=https://your-api.fly.dev
VITE_WS_URL=https://your-api.fly.dev
```

## Project Organization

### Code Structure
```
# IMPORTANT: Always work from PROJECT ROOT directory
# Run ALL commands from project root (NOT from frontend subdirectory)
# Use --prefix frontend for npm commands

PROJECT_ROOT/
├── frontend/           # Frontend React app (created as subdirectory)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/      # Layout components
│   │   │   ├── vibecode/    # Vibecode panel components
│   │   │   ├── code/        # Code viewer components
│   │   │   └── test/        # Test runner components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API and WebSocket services
│   │   └── store/           # Zustand state management
│   ├── tests/
│   │   ├── integration/     # Vitest + Testing Library
│   │   └── e2e/            # Playwright (HEADLESS)
│   └── validated_test_evidence/  # Test artifacts (phase-XXX/)
├── backend/            # Backend FastAPI app
├── plans/             # Implementation phases
└── spec_*.md          # Specifications
```

### Testing Strategy (Vitest + Playwright)
- **CRITICAL**: Backend MUST be running or tests fail immediately
- **Integration**: Vitest + React Testing Library (real backend, NO mocking)
- **E2E**: Playwright running HEADLESS (real backend)
- **NO MOCKS**: All tests hit real backend with real OpenAI API
- **Focus**: User flows and component interactions
- **shadcn Testing**: shadcn components are built on Radix UI primitives. Test them by:
  - Using `data-testid` attributes on shadcn component usage
  - Testing by ARIA roles (e.g., `role="dialog"` for Dialog)
  - Using accessible names (e.g., `getByRole('button', { name: /submit/i })`)
  - shadcn doesn't provide test helpers - use standard React Testing Library

### Playwright MCP Manual Testing (BEFORE Writing Scripts)
Before writing Playwright test scripts, use the Playwright MCP server to:
1. **Human-like QA Testing**: Connect to the app and explore like a QA agent
2. **Test Different Workflows**: Click buttons, fill forms, navigate through flows
3. **Monitor Console**: Carefully check error messages and console logs
4. **Take Screenshots**: Capture UI states and analyze them yourself (ensure reasonable size)
5. **Visual Analysis**: Look at the screenshots yourself to spot visual bugs
6. **IMPORTANT: Commit Screenshots**: Save and git commit screenshots to `frontend/validated_test_evidence/phase-XXX/` showing:
   - Homepage with projects list
   - Three-panel layout on project page  
   - Dark mode enabled/disabled states
   - Any UI errors or bugs discovered
7. **Test Mobile**: Check at mobile breakpoint (375px width)
8. **Verify Scrolling**: Ensure mobile scrolling behaves correctly
9. **Track Bugs**: Keep a list of discovered issues
10. **Fix Simple Bugs**: Immediately fix and re-test simple issues
11. **Write Scripts for Complex**: Create Playwright scripts for complex bugs
12. **Fresh Project Testing**: Start with a new project, delete when done

### Running Tests
```bash
# IMPORTANT: Stay in PROJECT ROOT - do NOT cd into frontend/
# All commands run from project root using --prefix frontend

# PREREQUISITE: Backend must be running!
# Check backend health first:
curl http://localhost:8000/projects || { echo "Backend not running!"; exit 1; }

# IMPORTANT: Always use --watchAll=false for CI/automation
npm --prefix frontend test -- --watchAll=false

# Run Vitest tests (headless by default)
npm --prefix frontend test -- --run  # Runs once and exits

# Run specific test file
npm --prefix frontend test -- --run tests/integration/phase001-layout.test.tsx

# Run E2E tests with Playwright (headless)
# IMPORTANT: Playwright tests MUST use max 30s timeout
# Do NOT set arbitrarily long timeouts
# SAFE cd: guaranteed return to project root
PROJECT_ROOT=$(pwd)
cd frontend && npx playwright test; cd "$PROJECT_ROOT"

# Run E2E with UI (for debugging only)
cd frontend && npx playwright test --ui; cd "$PROJECT_ROOT"

# Generate coverage report
npm --prefix frontend run test:coverage
```


## shadcn/ui Setup

### Initial Setup (One-time)
```bash
# IMPORTANT: Start in PROJECT ROOT, never leave project root
pwd  # Should show: /path/to/vibegrapher-specs (or your project root)

# Create Vite app as subdirectory (FROM PROJECT ROOT)
npm create vite@latest frontend -- --template react-ts

# Configure frontend dependencies (use --prefix from project root)
npm --prefix frontend install -D tailwindcss postcss autoprefixer

# SAFE cd operations - always return to project root even if commands fail
PROJECT_ROOT=$(pwd)
cd frontend && npx tailwindcss init -p; cd "$PROJECT_ROOT"  # Semicolon ensures cd back
cd frontend && npx shadcn-ui@latest init; cd "$PROJECT_ROOT"

# Add ALL required components upfront (safe cd with guaranteed return)
cd frontend && npx shadcn-ui@latest add alert alert-dialog avatar badge button; cd "$PROJECT_ROOT"
cd frontend && npx shadcn-ui@latest add card collapsible dialog drawer dropdown-menu; cd "$PROJECT_ROOT"
cd frontend && npx shadcn-ui@latest add input popover progress scroll-area separator; cd "$PROJECT_ROOT"
cd frontend && npx shadcn-ui@latest add sheet sonner table tabs textarea tooltip; cd "$PROJECT_ROOT"

# Verify you're back in project root
pwd  # Should show project root
```

## Implementation Phases

**IMPORTANT: Some details in the plan files MAY BE WRONG. They were generated by an LLM. If you find in your own testing they are wrong and that a different approach works better (as long as you meet acceptance criteria), make your UPDATE to the plan file and explain what old information was wrong and what is the replacement.**

See `plans/frontend-phase-*.md` for detailed requirements:

1. **Phase 001**: Core Layout → `plans/frontend-phase-001-layout.md`
2. **Phase 002**: Local Persistence → `plans/frontend-phase-002-local-persistence.md`
3. **Phase 003**: Mobile Responsive → `plans/frontend-phase-003-mobile.md`
4. **Phase 004**: Socket.io Setup → `plans/frontend-phase-004-socketio.md`
5. **Phase 005**: Session Management → `plans/frontend-phase-005-session.md`
6. **Phase 006**: Code Viewer → `plans/frontend-phase-006-code-viewer.md`
7. **Phase 007**: Diff Handling → `plans/frontend-phase-007-diff.md`
8. **Phase 008**: Human Review UI → `plans/frontend-phase-008-human-review.md`
   - **IMPORTANT**: Contains critical E2E test for complete vibecoder workflow
9. **Phase 009**: Production Deployment → `plans/frontend-phase-009-deployment.md`

## Critical Requirements

### Real Backend Integration
- ALL data comes from REAL OpenAI API calls
- NEVER mock token usage or API responses
- Socket.io messages must include token usage data
- See `spec_frontend_v0.md` for detailed Socket.io integration and state management patterns

### Environment-Aware URLs
```typescript
// CORRECT - Always use environment variables
const API_URL = import.meta.env.VITE_API_URL || ''

// DEPLOYMENT SCENARIOS:
// 1. Local development: VITE_API_URL=http://localhost:8000
// 2. Remote development: VITE_API_URL=http://YOUR_SERVER_IP:8000
// 3. Production: VITE_API_URL=https://your-api.fly.dev

// WRONG - Hardcoded URLs break in different environments
const API_URL = 'http://localhost:8000'  // Won't work remotely!
```

## Quality Checklist

Before EVERY commit:
- [ ] Backend is running (`curl http://localhost:8000/projects`)
- [ ] TypeScript type checking passes (`npm run typecheck`)
- [ ] Tests pass (`npm test`) - using REAL backend with OpenAI API
- [ ] E2E tests pass (`npx playwright test`) - against REAL APIs
- [ ] No hardcoded URLs
- [ ] All components have proper type annotations
- [ ] Zustand store and actions are fully typed
- [ ] React Query hooks use typed generics
- [ ] Socket.io debug logs working with REAL token usage
- [ ] All errors logged with stack traces to console
- [ ] Network errors displayed to user immediately
- [ ] shadcn components used consistently  
- [ ] Mobile responsive (375px minimum)
- [ ] All tests run HEADLESS
- [ ] NO MOCKED backend responses anywhere

## Git Commit Messages
- Keep commits factual and minimal
- Format: "Add/Fix/Update [component]: [what changed]"
- Examples:
  - "Add frontend: vibecode panel component"
  - "Fix websocket: connection error handling"
  - "Update tests: add backend health check"
- No emojis, no business impact statements, no verbose explanations

## Deployment Scenarios

### Local Development (from project root)
```bash
# PREREQUISITE: Backend must already be running
# Check backend health before starting frontend:
curl http://localhost:8000/projects || { echo "Backend not running! Start it first."; exit 1; }

# Start frontend (from project root)
npm --prefix frontend run dev  # Runs on :5173

# Use frontend/.env.local with VITE_API_URL=http://localhost:8000
```

### Remote Development Access
```bash
# PREREQUISITE: Backend must already be running on remote server
# Check backend health before starting frontend:
curl http://YOUR_SERVER_IP:8000/projects || { echo "Remote backend not accessible!"; exit 1; }

# Start frontend (from project root)
npm --prefix frontend run dev

# Use frontend/.env.development with VITE_API_URL=http://YOUR_SERVER_IP:8000
# Replace YOUR_SERVER_IP with actual server IP (e.g., 192.168.1.100)
```

### Production (fly.io)
```bash
# PREREQUISITE: Backend must already be deployed to fly.io
# Check backend health before deploying frontend:
curl https://your-api.fly.dev/projects || { echo "Production backend not accessible!"; exit 1; }

# Use frontend/.env.production with VITE_API_URL=https://your-api.fly.dev
# All connections over HTTPS
```

## Remember
- Use shadcn/ui components everywhere
- Vitest for integration tests (not Jest)
- Playwright runs HEADLESS
- Log ALL Socket.io messages with token usage
- Mobile-first responsive design
- Environment variables for ALL URLs

# Final Instructions - Infinite Loop Workflow
**Work continuously in this loop until you get stuck with errors:**

1. Read the specs files: `spec_datamodel_v0.md` and `spec_frontend_v0.md`
2. Go into the `plans/` directory and find the first frontend document that is not done
3. Check first few lines to see if done - do not read whole file
4. Complete that phase entirely
5. Once done, write a header `# DONE as of commit [commit-hash]`
6. **Re-read specs and this prompt file (to refresh context)**
7. **LOOP BACK TO STEP 2** - find the next incomplete frontend document
8. **Continue this infinite loop until you get stuck with bugs**
9. **ONLY COMMIT WORKING CODE!** - Stop if code doesn't work

## Deployment Notes (Phase 009)
- Deploy to Fly.io EWR region as static site with NGINX
- Use GitHub Actions for CI/CD (see `plans/frontend-phase-009-deployment.md`)
- Production: never scale to 0, autoscale up to 3
- Preview: scale to 0 for PR deployments
- Multi-stage Docker build for optimization
- Bundle splitting and PWA support