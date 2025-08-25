# Vibegrapher FUTURE Features Specification

## AST Parser & Node-Based Editing (v1)

### Backend AST Parser Service
```python
class AgentNode:
    name: str
    line_start: int
    line_end: int
    children: List[str]  # Names of child agents if any

class ASTParserService:
    # Extract Agent() calls with line numbers
    # Update specific nodes without affecting others
    # Handle nested and complex agent definitions
```

### Frontend Node Selection
```typescript
// Click on graph node → highlight code in editor
// Node-specific sessions for targeted editing
// Visual indicators for node status
```

## Test Sandbox & Runner (v1)

### Test Data Models
```typescript
interface TestCase {
  id: string;
  project_id: string;
  name: string;
  test_code: string;           // Python code that tests the agent functionality
  quick_test: boolean;         // If true, runs with 30s timeout during review
  created_at: string;
  updated_at: string;
}

interface TestRun {
  id: string;
  diff_id: string;             // Which diff this test was run against
  test_case_id: string;
  status: 'passed' | 'failed' | 'error' | 'timeout';
  output?: string;             // stdout/stderr from test execution
  error?: string;              // Error message if failed
  execution_time_ms: number;
  created_at: string;
}

interface TestResult {
  test_id: string;
  test_name: string;
  status: 'passed' | 'failed' | 'error' | 'timeout' | 'running';
  output?: string;
  error?: string;
  execution_time_ms?: number;
}
// Note: TestResult is derived from TestRun records for frontend display
```

### Backend Sandbox Service
```python
class SandboxService:
    # Run code in isolated subprocess
    # Resource limits: 30s timeout, 512MB memory
    # Security: No network, file system restrictions
    # Stream output via WebSocket
```

### Test API Endpoints
```
POST   /projects/:id/tests        - Create test case for diff validation
GET    /projects/:id/tests        - List available tests
GET    /projects/:id/tests/quick  - Get quick tests (30s timeout) for human review
POST   /diffs/:id/test            - Run tests on uncommitted diff
POST   /tests/:id/run             - Run test in sandbox
```

### Frontend Test Runner UI
```typescript
// Test management with shadcn Table
// Add/edit tests via Dialog
// Real-time test execution with Progress bar
// Pass/fail indicators with Alert components
// Collapsible output viewer
```

### Test Features
- Quick tests (5s timeout) for rapid validation
- Full test suite execution
- Test result caching on diffs
- Integration with human review flow

## Graph Visualization (v1)

### Backend Additions
```python
class GraphService:
    async def generate_graph_svg(project_id: str) -> str
        # Use OpenAI SDK's draw_graph
        # Patch SVG with data-node-id attributes
        # Return SVG string

# Endpoints
GET /projects/:id/graph    - Get SVG visualization
GET /projects/:id/nodes    - List parsed nodes
```

### Frontend Additions
```typescript
// GraphVisualization component
interface GraphVisualizationProps {
  projectId: string;
  onNodeClick: (nodeId: string) => void;
}

// Features:
// - Render SVG from backend
// - Click handlers via data-node-id
// - Pan/zoom with svg-pan-zoom
// - Node status indicators
// - Test result badges
```

### Layout Update
```
Desktop: 50% Vibecode | 25% Graph | 25% Tests
Mobile: Toggle between views
```

## Advanced Testing (v1)

### Parallel Test Execution
```python
async def run_all_tests_parallel(project_id: str):
    # Run up to 10 tests simultaneously
    # Stream results via WebSocket
```

### Test Evaluation Metrics
- Response time tracking
- Token usage per test
- Success rate over time
- Regression detection

## Rate Limiting (v2)

```python
class RateLimiter:
    # Per-user limits
    # Queue management
    # Priority tiers
```

## Collaborative Features (v2)

### Branching & Merging
```python
class BranchingService:
    async def create_branch(project_id: str, branch_name: str)
    async def merge_branches(project_id: str, source: str, target: str)
    async def resolve_conflicts(project_id: str, strategy: str)
```

### Real-time Cursors
- Show other users' selected nodes
- Live typing indicators
- Collaborative test editing

## Advanced Agents (v3)

### Optimization Agent
```python
optimization_agent = Agent(
    name="Optimizer",
    instructions="Optimize agent code for performance and cost",
    tools=[analyze_token_usage, suggest_caching, refactor_prompts]
)
```

### Documentation Agent
```python
docs_agent = Agent(
    name="Documenter",
    instructions="Generate documentation for agent workflows",
    output_type=MarkdownDocument
)
```

## Export/Import (v3)

### Export Formats
- Standalone Python package
- Docker container
- OpenAPI specification
- Jupyter notebook

### Import Sources
- GitHub repositories
- Existing Python files
- OpenAI Playground exports

## Analytics Dashboard (v4)

### Metrics
- Agent performance
- Cost tracking
- Usage patterns
- Error analysis

### Visualizations
- Token usage over time
- Success rates by agent
- User activity heatmap
- Cost breakdown

## Enterprise Features (v5)

### SSO Integration
- SAML 2.0
- OAuth providers
- Active Directory

### Audit Logging
- Complete action history
- Compliance reports
- Data retention policies

### Role-Based Access Control
- Project permissions
- Agent editing restrictions
- Test execution limits

## Message Detail Expansion (v1)

### Frontend Enhancement
```typescript
// Click any message in conversation history to expand full details
interface ExpandedMessage {
  full_patch: string;        // Complete diff, not just preview
  original_code: string;      // Full original code
  modified_code: string;      // Full modified code  
  evaluator_reasoning: string; // Complete reasoning
  timestamp: string;         // When message was created
  raw_response: any;         // Full OpenAI response object
}

// Implementation:
// - GET /messages/:id/full returns complete details
// - Modal or inline expansion UI
// - Syntax highlighting for code/diffs
// - Copy buttons for code sections
```

## Offline-First Architecture (v2)

### Technology Choice
- **persist-and-sync** middleware for Zustand
- **IndexedDB** for large data (code, diffs, messages)
- **Service Worker** for PWA and background sync
- **Optimistic updates** with rollback on conflict

### Offline Features
- Browse all code without connection
- Review past diffs and test results
- Queue messages for sending when online
- Run cached tests locally
- Complete history available offline

### Storage Strategy
```typescript
// IndexedDB: projects, messages, diffs, test results (large data)
// localStorage: UI state, drafts, preferences (small data)
// Conflict resolution: last-write-wins for simplicity
// Sync: bidirectional with queue for offline actions
```

### Mobile Benefits
- PWA installable
- Works in subway/airplane
- Instant access (no loading)
- Reduced data usage
- Battery efficient background sync

## AI-Powered Enhancements (Future)

### Auto-suggestion
- Suggest next agent based on pattern
- Recommend test cases
- Propose optimizations

### Smart Debugging
- Automatic error diagnosis
- Suggested fixes
- Root cause analysis

### Performance Prediction
- Estimate token usage
- Predict execution time
- Cost forecasting