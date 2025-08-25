# Vibegrapher v0 Data Model & API Specification (Simplified)

## Core Data Models

### Project
```typescript
interface Project {
  id: string;                    // UUID
  name: string;
  description?: string;
  created_at: timestamp;
  updated_at: timestamp;
  repository_path: string;       // Git repo location
  owner_id: string;
  current_code?: string;         // Current Python code
}
```

### VibecodeSession
```typescript
interface VibecodeSession {
  id: string;                    // UUID
  project_id: string;
  node_id?: string;              // null for global
  type: 'global' | 'node';
  status: 'active' | 'completed';
  openai_session_key: string;    // Maps to SQLiteSession
  created_at: timestamp;
}
```

### TokenUsage
```typescript
interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
  agent?: string;               // 'vibecoder' | 'evaluator' 
  iteration?: number;           // Agent iteration number
}
```

### ConversationMessage
```typescript
interface ConversationMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;               // Display text
  openai_response?: any;         // FULL OpenAI response (untyped JSON)
  token_usage?: TokenUsage;      // Extracted token usage data
  timestamp: timestamp;
  diff?: string;                 // If changes proposed
}
```

### TestCase
```typescript
interface TestCase {
  id: string;
  project_id: string;
  name: string;
  input_prompt: string;
  expected_behavior?: string;
  created_at: timestamp;
}
```

### TestRun
```typescript
interface TestRun {
  id: string;
  test_case_id: string;
  status: 'running' | 'passed' | 'failed' | 'error';
  output?: string;
  error?: string;
  started_at: timestamp;
  completed_at?: timestamp;
  trace_id?: string;  // Consistent naming
}
```

## API Endpoints (v0 - Simplified)

### Projects
```
POST   /projects                 - Create new project
GET    /projects/:id             - Get project with current code
DELETE /projects/:id             - Delete project
```

### Sessions & Vibecoding
```
POST   /projects/:id/sessions    - Start new vibecode session (global or node-specific)
GET    /projects/:id/sessions    - List active sessions for project
POST   /sessions/:id/messages    - Send message to existing session
GET    /sessions/:id/messages    - Get conversation history
DELETE /sessions/:id             - Clear/reset session
GET    /messages/:id/full        - Get full OpenAI response data
```

### Testing
```
POST   /projects/:id/tests       - Create test case
GET    /projects/:id/tests       - List test cases
POST   /tests/:id/run           - Run single test
DELETE /tests/:id               - Delete test
```

## Request/Response Formats

### Start Session Request
```typescript
POST /projects/:id/sessions
{
  node_id?: string;  // If provided, creates node-specific session
}

Response:
{
  session_id: string;
  type: 'global' | 'node';
  node_id?: string;
}
```

### Send Message Request
```typescript
POST /sessions/:id/messages
{
  prompt: string;
}

Response:
{
  message_id: string;      // For fetching full data
  diff?: string;           // If code changes proposed
  status: 'success' | 'needs_input' | 'error';
  trace_id?: string;       // OpenAI trace ID if available
}
```

### Get Full Message
```typescript
GET /messages/:id/full

Response: any  // Untyped JSON with complete OpenAI data
{
  content: string;
  tool_calls?: [...];
  usage?: {...};
  model?: string;
  // ... any other OpenAI fields
}
```

### Socket.io Events
```typescript
// Server → Client Events
// Event: 'vibecode_response'
{
  session_id: string;
  message_id: string;
  diff?: string;
  trace_id?: string;    // OpenAI trace for debugging
  token_usage?: TokenUsage;  // Real-time usage data
}

// Event: 'code_changed'
{
  project_id: string;
  new_code: string;
}

// Event: 'test_completed'
{
  test_id: string;
  status: string;
  output?: string;
  trace_id?: string;  // OpenAI trace for test run
}

// Client → Server Events
// Event: 'subscribe'
{
  project_id: string;
}

// Event: 'token_usage' - Real-time usage tracking
{
  session_id: string;
  message_id?: string;
  usage: TokenUsage;
  timestamp: string;    // ISO timestamp
}

// Event: 'disconnect'
// (handled automatically by Socket.io)
```

## OpenAI Agents SDK Integration

### Session Management
- Each project has one global SQLiteSession
- Each node can have its own SQLiteSession
- Session key format: `project_{id}` or `project_{id}_node_{node_id}`
- Sessions persist conversation history automatically

### Agent Handoffs
- Vibecoder → SyntaxFixer (on syntax error)
- Vibecoder → Evaluator (on valid code)
- Evaluator can reject back to Vibecoder

### Stored OpenAI Data
The `openai_response` field stores everything:
- Final output text
- Tool calls made
- Token usage
- Model used
- Reasoning traces
- Any future fields OpenAI adds

## Database Schema (SQLAlchemy)

```python
class Project(Base):
    __tablename__ = 'projects'
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    repository_path = Column(String, unique=True)
    owner_id = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

class VibecodeSession(Base):
    __tablename__ = 'vibecode_sessions'
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey('projects.id'))
    node_id = Column(String, nullable=True)
    type = Column(String)  # 'global' or 'node'
    status = Column(String)
    openai_session_key = Column(String, unique=True)
    created_at = Column(DateTime, server_default=func.now())

class ConversationMessage(Base):
    __tablename__ = 'conversation_messages'
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey('vibecode_sessions.id'))
    role = Column(String)
    content = Column(Text)
    openai_response = Column(JSON)  # Stores everything
    token_usage = Column(JSON, nullable=True)  # TokenUsage as JSON
    diff = Column(Text, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

class TestCase(Base):
    __tablename__ = 'test_cases'
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey('projects.id'))
    name = Column(String)
    input_prompt = Column(Text)
    expected_behavior = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class TestRun(Base):
    __tablename__ = 'test_runs'
    id = Column(String, primary_key=True)
    test_case_id = Column(String, ForeignKey('test_cases.id'))
    status = Column(String)
    output = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    trace_id = Column(String, nullable=True)  # Consistent naming
```