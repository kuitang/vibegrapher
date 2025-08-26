"""
Unit tests to verify the agents structure is correctly implemented
"""

import pytest

from app.agents.all_agents import (
    EvaluationResult,
    VibecodeResult,
    apply_patch,
    evaluator_agent,
    submit_patch,
    validate_patch,
    vibecoder_agent,
)


def test_agents_exist():
    """Test that both agents are properly created"""
    assert vibecoder_agent is not None
    assert vibecoder_agent.name == "Vibecoder"
    assert evaluator_agent is not None
    assert evaluator_agent.name == "Evaluator"


def test_vibecoder_has_tools():
    """Test that VibeCoder agent has the submit_patch tool"""
    assert len(vibecoder_agent.tools) == 1
    tool = vibecoder_agent.tools[0]
    assert hasattr(tool, "name")
    assert tool.name == "submit_patch"


def test_evaluator_has_output_type():
    """Test that Evaluator agent has output_type set"""
    assert evaluator_agent.output_type == EvaluationResult


def test_apply_patch_simple():
    """Test simple patch application"""
    original = """def hello():
    print("Hello")"""

    patch = """@@ -1,2 +1,3 @@
+# Comment
 def hello():
     print("Hello")"""

    result = apply_patch(original, patch)
    assert result is not None
    assert "# Comment" in result
    assert "def hello():" in result


def test_validate_patch_valid_code():
    """Test validation with valid Python code"""
    original = """def hello():
    print("Hello")"""

    patch = """@@ -1,2 +1,3 @@
+# Comment
 def hello():
     print("Hello")"""

    result = validate_patch(original, patch)
    assert result["valid"] is True
    assert "patched_code" in result
    assert "# Comment" in result["patched_code"]


def test_validate_patch_invalid_syntax():
    """Test validation with invalid Python syntax"""
    original = """def hello():
    print("Hello")"""

    # This patch creates invalid syntax
    patch = """@@ -1,2 +1,3 @@
+def broken(:
 def hello():
     print("Hello")"""

    result = validate_patch(original, patch)
    assert result["valid"] is False
    assert "error" in result
    assert "SyntaxError" in result["error"]


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
        content="Some text response", token_usage={"total_tokens": 100}
    )
    assert result.content == "Some text response"
    assert result.diff_id is None
    assert result.patch is None
    assert result.token_usage["total_tokens"] == 100

    # Test to_dict method
    dict_result = result.to_dict()
    assert dict_result["content"] == "Some text response"
    assert dict_result["token_usage"]["total_tokens"] == 100
