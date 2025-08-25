# Backend Phase 004: OpenAI Agents Integration

## Objectives
Implement VibeCoder and Evaluator agents with patch submission workflow per spec_backend_v0.md.

## Implementation Tasks
1. Create `app/agents/all_agents.py` with ALL agents in ONE file
2. Implement submit_patch tool that validates patches before submission
3 Apply tenacity for exponential backoff on OpenAI API calls
4. VibeCoder agent with TWO modes:
   - submit_patch() → triggers evaluator loop
   - return text → direct response to user
5. Evaluator agent that reviews patches
6. VibecodeService with MAX 3 iteration loop
7. **CREATE Diff model** (see spec_datamodel_v0.md lines 229-258 for full schema)
8. Implement diff creation when evaluator approves patches

## Acceptance Criteria
- ✅ VibeCoder can submit patches via submit_patch tool
- ✅ submit_patch validates syntax and patch application IN ONE STEP
- ✅ Validation returns VERBATIM errors if patch/syntax invalid
- ✅ VibeCoder can return text without patching
- ✅ Evaluator reviews patches AND suggests commit messages
- ✅ Loop runs max 3 iterations between agents
- ✅ **Diff model created and stored in database** (status='evaluator_approved')
- ✅ Approved diffs accessible via GET /sessions/:id/diffs/pending endpoint
- ✅ Human rejection triggers new vibecode iteration
- ✅ SQLiteSession persists conversation history
- ✅ REAL OpenAI token usage logged for each agent call
- ✅ Token usage streamed via Socket.io in real-time
- ✅ NO MOCKED OpenAI responses - ALL calls use real API

## Integration Tests (pytest + httpx)
```python
# tests/integration/test_phase_003_agents.py
import pytest
import httpx
from httpx import AsyncClient
import logging

@pytest.mark.asyncio
async def test_vibecode_patch_submission(caplog):
    # CRITICAL: This test uses REAL OpenAI API with valid key
    # Must show OpenAI token usage in logs
    caplog.set_level(logging.INFO)
    
    service = VibecodeService()
    result = await service.vibecode(
        project_id="test",
        prompt="Add a Spanish translation agent",
        current_code=sample_code
    )
    
    # Test output (minimal):
    print(f"Running: vibecode with prompt")
    print(f"Result: patch={bool(result.get('patch'))}, tokens={result.get('usage', {}).get('total_tokens', 0)}")
    print(f"Expected: patch=True")
    
    # Verify token logging appears
    assert "💵 OPENAI TOKENS" in caplog.text
    assert result.get("patch") is not None
    assert "spanish_agent" in result["patch"].lower()
    assert result.get("trace_id") is not None
    # Verify REAL token usage was tracked
    assert result.get("token_usage") is not None
    assert result["token_usage"]["total_tokens"] > 0

def test_vibecode_text_response():
    result = await service.vibecode(
        project_id="test",
        prompt="What does this code do?",
        current_code=sample_code
    )
    assert result.get("patch") is None
    assert result.get("response") is not None

def test_evaluator_iteration():
    # Test that evaluator feedback triggers retry
    result = await service.vibecode(
        project_id="test",
        prompt="Add complex feature",
        current_code=sample_code
    )
    # Check logs for iteration count
    assert service.last_iteration_count <= 3
```

## Validation Requirements
- Write pytest + httpx integration tests with REAL OpenAI API calls (requires OPENAI_API_KEY)
- Test manually with curl: create sessions, send messages, verify vibecode responses
- **Test Diff creation flow**:
  1. Send a trivial prompt like "Add a comment saying hello"
  2. Verify evaluator approves (make evaluator lenient for testing)
  3. Check diff is created with GET /sessions/:id/diffs/pending
  4. Verify diff has: status='evaluator_approved', commit_message, evaluator_reasoning
  5. Test GET /diffs/:id endpoint returns full diff details
- Verify SQLiteSession files are created and token usage is logged
- Test both patch submission and text response modes
- Confirm evaluator loop works with max 3 iterations
- Save test evidence including diff JSON in backend/validated_test_evidence/phase-004/

## Key Code Structure (from spec_backend_v0.md)
```python
# app/agents/all_agents.py - ALL agents in ONE file
# IMPORTANT: gpt-5-thinking and gpt-5-mini are REAL MODELS - USE THEM!
from agents import Agent, Runner, function_tool, SQLiteSession
from pydantic import BaseModel

MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-thinking",  # REAL MODEL - DO NOT USE gpt-4o!
    "SMALL_MODEL": "gpt-5-mini"  # REAL MODEL - DO NOT USE gpt-4o!
}

# Define EvaluationResult Pydantic model - INCLUDES COMMIT MESSAGE
class EvaluationResult(BaseModel):
    approved: bool
    reasoning: str
    commit_message: str  # Suggested commit message if approved

# Validation function - apply patch then check syntax in ONE STEP
def validate_patch(original: str, patch: str) -> dict:
    # 1. Apply patch to temp copy
    # 2. Run Python syntax check on result
    # 3. Return {valid: bool, error?: str} with VERBATIM error if invalid

@function_tool
async def submit_patch(ctx, patch: str, description: str) -> dict:
    # 1. Get current_code from ctx.state
    # 2. Run validate_patch() - single step validation
    # 3. If invalid, return verbatim error to user
    # 4. If valid, store in ctx.state["submitted_patch"]
    # 5. Return {status: "submitted", handoff_to_evaluator: True}

vibecoder_agent = Agent(
    name="Vibecoder",
    model=MODEL_CONFIGS["THINKING_MODEL"],
    instructions="Generate patches OR answer questions...",
    tools=[submit_patch]
)

evaluator_agent = Agent(
    name="Evaluator",
    model=MODEL_CONFIGS["THINKING_MODEL"],
    instructions="Evaluate patches AND suggest commit messages...",
    output_type=EvaluationResult  # Now includes commit_message field
)

class VibecodeService:
    async def vibecode(project_id, prompt, current_code, node_id=None):
        # Create session key with correct format (uses project.slug for consistency)
        session_key = f"project_{project.slug}_node_{node_id}" if node_id else f"project_{project.slug}"
        # Use project.slug for filesystem paths to ensure valid filenames
        db_path = f"media/projects/{project.slug}_conversations.db"
        session = SQLiteSession(session_key, db_path)  # MUST use file persistence, not in-memory
        for iteration in range(3):  # MAX 3 iterations
            # Run VibeCoder with context
            # Check if patch submitted
            # If not, return text response
            # If yes, run Evaluator
            # If approved:
            #   - Create Diff record with status='evaluator_approved'
            #   - Return diff_id for human review
            # If rejected, loop with feedback
    
    async def handle_human_rejection(diff_id, feedback):
        # Get rejected diff
        # Create new prompt with human feedback
        # Call vibecode() again with new prompt
```

## Deliverables
- [ ] All agents in app/agents/all_agents.py with commit message generation
- [ ] VibecodeService in app/services/vibecode_service.py with diff creation
- [ ] **Diff model in app/models/diff.py** (following spec_datamodel_v0.md)
- [ ] Basic diff endpoints in app/api/diffs.py:
  - GET /sessions/:id/diffs/pending
  - GET /diffs/:id
- [ ] Tests in tests/integration/test_phase_004_agents.py including diff tests
- [ ] Validation evidence with diff samples in backend/validated_test_evidence/phase-004/