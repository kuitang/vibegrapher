# Backend Phase 004: OpenAI Agents Integration

## Objectives
Implement VibeCoder and Evaluator agents with patch submission workflow per spec_backend_v0.md.

## Implementation Tasks
1. Create `app/agents/all_agents.py` with ALL agents in ONE file
2. Implement submit_patch tool that validates patches before submission
3. VibeCoder agent with TWO modes:
   - submit_patch() → triggers evaluator loop
   - return text → direct response to user
4. Evaluator agent that reviews patches
5. VibecodeService with MAX 3 iteration loop

## Acceptance Criteria
- ✅ VibeCoder can submit patches via submit_patch tool
- ✅ submit_patch validates syntax and patch application
- ✅ VibeCoder can return text without patching
- ✅ Evaluator reviews and approves/rejects patches
- ✅ Loop runs max 3 iterations between agents
- ✅ SQLiteSession persists conversation history
- ✅ REAL OpenAI token usage logged for each agent call
- ✅ Token usage streamed via Socket.io in real-time
- ✅ NO MOCKED OpenAI responses - ALL calls use real API

## Integration Tests (pytest + httpx)
```python
# tests/integration/test_phase_004_agents.py
import pytest
import httpx
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_vibecode_patch_submission():
    # CRITICAL: This test uses REAL OpenAI API with valid key
    service = VibecodeService()
    result = await service.vibecode(
        project_id="test",
        prompt="Add a Spanish translation agent",
        current_code=sample_code
    )
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
- Verify SQLiteSession files are created and token usage is logged
- Test both patch submission and text response modes
- Confirm evaluator loop works with max 3 iterations
- Save test evidence in validated_test_evidence/phase-004/

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

# Define EvaluationResult Pydantic model
class EvaluationResult(BaseModel):
    approved: bool
    reasoning: str

# Validation functions (deterministic, not agents)
def check_syntax(code: str) -> dict
def check_patch_applies(original: str, patch: str) -> dict
def apply_patch(original: str, patch: str) -> str

@function_tool
async def submit_patch(ctx, patch: str, description: str) -> dict:
    # 1. Get current_code from ctx.state
    # 2. Check patch applies cleanly
    # 3. Apply patch to get new_code
    # 4. Check syntax of new_code
    # 5. Store in ctx.state["submitted_patch"]
    # 6. Return {status: "submitted", handoff_to_evaluator: True}

vibecoder_agent = Agent(
    name="Vibecoder",
    model=MODEL_CONFIGS["THINKING_MODEL"],
    instructions="Generate patches OR answer questions...",
    tools=[submit_patch]
)

evaluator_agent = Agent(
    name="Evaluator",
    model=MODEL_CONFIGS["THINKING_MODEL"],
    instructions="Evaluate patches for quality/correctness...",
    output_type=EvaluationResult
)

class VibecodeService:
    async def vibecode(project_id, prompt, current_code, node_id=None):
        for iteration in range(3):  # MAX 3 iterations
            # Run VibeCoder with context
            # Check if patch submitted
            # If not, return text response
            # If yes, run Evaluator
            # If approved, return patch
            # If rejected, loop with feedback
```

## Deliverables
- [ ] All agents in app/agents/all_agents.py
- [ ] VibecodeService in app/services/vibecode_service.py
- [ ] Tests in tests/integration/test_phase_004_agents.py
- [ ] Validation evidence in validated_test_evidence/phase-004/