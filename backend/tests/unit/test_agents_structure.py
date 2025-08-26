"""
Unit tests to verify the agents structure is correctly implemented
"""

from app.agents.all_agents import (
    EvaluationResult,
    VibecodeResult,
    VibecodeService,
    evaluator_agent,
)


def test_evaluator_agent_exists():
    """Test that evaluator agent is properly created"""
    assert evaluator_agent is not None
    assert evaluator_agent.name == "Evaluator"


def test_evaluator_has_correct_model():
    """Test that Evaluator agent uses the thinking model"""
    # The evaluator uses structured output instead of tools
    assert evaluator_agent.model == "gpt-5"


def test_evaluator_has_output_type():
    """Test that Evaluator agent has output_type set"""
    assert evaluator_agent.output_type == EvaluationResult


def test_vibecode_service_exists():
    """Test that VibecodeService is available"""
    service = VibecodeService()
    assert service is not None


def test_evaluation_result_model():
    """Test EvaluationResult pydantic model"""
    result = EvaluationResult(
        approved=True, reasoning="Looks good", commit_message="Add helpful comment"
    )
    assert result.approved is True
    assert result.reasoning == "Looks good"
    assert result.commit_message == "Add helpful comment"


def test_vibecode_result_model():
    """Test VibecodeResult pydantic model"""
    result = VibecodeResult(
        content="Some text response", 
        openai_response={"usage": {"total_tokens": 100}}
    )
    assert result.content == "Some text response"
    assert result.diff_id is None
    assert result.openai_response["usage"]["total_tokens"] == 100


def test_vibecode_result_with_diff():
    """Test VibecodeResult with diff information"""
    result = VibecodeResult(
        content="",
        diff_id="diff-123",
        openai_response={"usage": {"total_tokens": 200}},
    )
    assert result.content == ""
    assert result.diff_id == "diff-123"
    assert result.openai_response["usage"]["total_tokens"] == 200