# Frontend Phase 001: Core Layout with shadcn

## Objectives
Set up React app with TypeScript, shadcn components and basic layout with strict type safety.

## Implementation Tasks
1. Configure TypeScript with strict mode
2. Basic routing (home, project page) with typed routes
3. Zustand store with typed state and actions
4. React Query configuration with typed queries
5. Two-panel layout using shadcn Card components
6. Set up shadcn theme and dark mode toggle

## Acceptance Criteria
- ✅ TypeScript strict mode enabled with no errors
- ✅ `npm run typecheck` passes with no errors
- ✅ Home page loads at / with project list
- ✅ Project page at /project/{id} shows two panels
- ✅ shadcn Card components used for panels
- ✅ Dark mode toggle functional
- ✅ Zustand store initialized with typed empty state
- ✅ React Query provider wraps app with typed hooks
- ✅ All components have proper type annotations

## Integration Tests (Vitest + Testing Library)
```typescript
// tests/integration/phase_001_layout.test.tsx
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../src/App'

describe('Phase 001: Core Layout', () => {
  test('renders two-panel layout with shadcn Cards', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    
    // Navigate to project page
    window.history.pushState({}, '', '/project/test')
    
    // Verify Card panels
    const cards = screen.getAllByRole('article')  // shadcn Cards have article role
    expect(cards).toHaveLength(2)
    
    // Verify panel test IDs
    expect(screen.getByTestId('vibecode-panel')).toBeInTheDocument()
    expect(screen.getByTestId('code-panel')).toBeInTheDocument()
  })
  
  test('dark mode toggle works', async () => {
    render(<App />)
    
    const toggle = screen.getByTestId('theme-toggle')
    await userEvent.click(toggle)
    
    expect(document.documentElement).toHaveClass('dark')
  })
  
  test('zustand store initializes', () => {
    const { result } = renderHook(() => useAppStore())
    
    expect(result.current.project).toBeNull()
    expect(result.current.currentSession).toBeNull()
    expect(result.current.messages).toEqual([])
  })
})
```

## E2E Test (Playwright - Headless)
```typescript
// tests/e2e/phase001-layout.e2e.ts
import { test, expect } from '@playwright/test'

test.describe('Phase 001: Layout E2E', () => {
  test('full layout renders with shadcn components', async ({ page }) => {
    await page.goto('http://localhost:5173/project/test')
    
    // Verify two Card panels
    await expect(page.locator('[data-testid="vibecode-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="code-panel"]')).toBeVisible()
    
    // Verify shadcn Card structure
    const cards = await page.locator('.card').count()
    expect(cards).toBeGreaterThanOrEqual(2)
    
    // Test dark mode toggle
    await page.click('[data-testid="theme-toggle"]')
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="frontend/validated_test_evidence/phase-001"
mkdir -p $OUTPUT_DIR

# IMPORTANT: Use --watchAll=false to ensure tests exit after running
# Run Vitest integration tests (headless)
npm test -- --run --watchAll=false tests/integration/phase_001_layout.test.tsx > $OUTPUT_DIR/vitest.log 2>&1

# Run Playwright E2E tests (headless)
npx playwright test tests/e2e/phase001-layout.e2e.ts --reporter=json > $OUTPUT_DIR/playwright.json

# Take screenshots (headless)
npx playwright screenshot http://localhost:5173 $OUTPUT_DIR/home.png
npx playwright screenshot http://localhost:5173/project/test $OUTPUT_DIR/project.png

echo "Phase 001 validation complete"
```

## Setup Commands
```bash
# Initial setup with Vite + shadcn
npm create vite@latest frontend -- --template react-ts
cd frontend

# Environment setup for different deployment scenarios
cat > .env.local << EOF
# Local development (default)
VITE_API_URL=http://localhost:8000
VITE_WS_URL=http://localhost:8000
EOF

cat > .env.development << EOF
# Remote development access (replace with your server IP)
VITE_API_URL=http://192.168.1.100:8000
VITE_WS_URL=http://192.168.1.100:8000
EOF

cat > .env.production << EOF
# Production deployment
VITE_API_URL=https://your-api.fly.dev
VITE_WS_URL=https://your-api.fly.dev
EOF

# Configure TypeScript strict mode
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

# Add typecheck script to package.json
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.typecheck:watch="tsc --noEmit --watch"

# Install and configure Tailwind + shadcn
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn-ui@latest init

# Add required shadcn components
npx shadcn-ui@latest add card button toggle separator

# Install core dependencies with types
npm install zustand @tanstack/react-query react-router-dom socket.io-client
npm install -D @types/react @types/react-dom @types/node

# Install test dependencies
npm install -D vitest @testing-library/react @testing-library/user-event
npm install -D @playwright/test msw@2
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