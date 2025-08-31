"""
Integration tests for Phase 004: OpenAI Agents
Tests real OpenAI API integration with vibecode workflow
"""

import logging
import os
from typing import Any

import httpx
import pytest

# Set up logging to capture token usage
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Sample code for testing
SAMPLE_CODE = '''"""
Agent Triage System - Example OpenAI Agents implementation
"""

class TriageAgent:
    def __init__(self):
        self.name = "TriageAgent"

    def process(self, message: str) -> str:
        if "billing" in message.lower():
            return "Routing to billing department..."
        else:
            return "Routing to general support..."
'''


@pytest.mark.integration
@pytest.mark.asyncio
async def test_vibecode_patch_submission(test_server: dict, caplog: Any) -> None:
    """Test vibecode with patch submission using REAL OpenAI API"""

    # Set API key for test
    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    if not os.environ["OPENAI_API_KEY"]:
        pytest.skip("OPENAI_API_KEY not set")

    caplog.set_level(logging.INFO)

    async with httpx.AsyncClient(base_url=test_server["url"], timeout=120.0) as client:
        # Use the seeded project that already has code
        projects_resp = await client.get("/projects")
        assert projects_resp.status_code == 200
        projects = projects_resp.json()

        # Find the Agent Triage System project (seeded with actual code)
        project = next(
            (p for p in projects if p["name"] == "Agent Triage System"), None
        )
        if not project:
            # Fallback: create project but with initial code
            project_resp = await client.post(
                "/projects", json={"name": "Test Agent Project"}
            )
            assert project_resp.status_code == 201
            project = project_resp.json()

        # Create session
        session_resp = await client.post(f"/projects/{project['id']}/sessions")
        assert session_resp.status_code == 201
        session = session_resp.json()

        # Send vibecode request - now the agent has actual code to modify
        message_resp = await client.post(
            f"/sessions/{session['id']}/messages",
            json={
                "prompt": "Add a comment at the top of the file saying '# Modified by AI'"
            },
        )
        assert message_resp.status_code == 200
        result = message_resp.json()

        print("Running: vibecode with patch prompt")
        print(
            f"Result: patch={bool(result.get('patch'))}, diff_id={result.get('diff_id')}"
        )
        print(f"Token usage: {result.get('token_usage', {})}")
        print("Expected: patch should be created")

        # Verify response
        assert result.get("error") is None, f"Error: {result.get('error')}"
        assert result.get("diff_id") or result.get(
            "patch"
        ), "Should have diff_id or patch"

        # Check token logging (may not capture server logs in integration test)
        # assert "💵 OPENAI TOKENS" in caplog.text, "Should log token usage"

        # Verify token usage tracked
        assert result.get("token_usage") is not None
        assert result["token_usage"].get("total_tokens", 0) > 0

        # If we got a diff_id, verify we can retrieve the diff
        if result.get("diff_id"):
            diff_resp = await client.get(f"/diffs/{result['diff_id']}")
            assert diff_resp.status_code == 200
            diff = diff_resp.json()
            assert diff["status"] == "evaluator_approved"
            assert diff.get("commit_message"), "Should have commit message"
            assert diff.get("evaluator_reasoning"), "Should have evaluator reasoning"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_vibecode_text_response(test_server: dict) -> None:
    """Test vibecode with text response (no patch)"""

    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    if not os.environ["OPENAI_API_KEY"]:
        pytest.skip("OPENAI_API_KEY not set")

    async with httpx.AsyncClient(base_url=test_server["url"], timeout=120.0) as client:
        # Create project
        project_resp = await client.post("/projects", json={"name": "Question Project"})
        assert project_resp.status_code == 201
        project = project_resp.json()

        # Create session
        session_resp = await client.post(f"/projects/{project['id']}/sessions")
        assert session_resp.status_code == 201
        session = session_resp.json()

        # Send question (should get text response, not patch)
        message_resp = await client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "What does this code do? Explain briefly."},
        )
        assert message_resp.status_code == 200
        result = message_resp.json()

        print("Running: vibecode with question prompt")
        print(f"Result: content={bool(result.get('content'))}")
        print("Expected: text response without patch")

        # Verify text response
        assert result.get("content") is not None, "Should have text content"
        assert result.get("patch") is None, "Should not have patch"
        assert result.get("diff_id") is None, "Should not have diff_id"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_evaluator_iteration(test_server: dict, caplog: Any) -> None:
    """Test that evaluator feedback triggers retry (max 3 iterations)"""

    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    if not os.environ["OPENAI_API_KEY"]:
        pytest.skip("OPENAI_API_KEY not set")

    caplog.set_level(logging.INFO)

    async with httpx.AsyncClient(base_url=test_server["url"], timeout=120.0) as client:
        # Create project
        project_resp = await client.post("/projects", json={"name": "Iteration Test"})
        assert project_resp.status_code == 201
        project = project_resp.json()

        # Create session
        session_resp = await client.post(f"/projects/{project['id']}/sessions")
        assert session_resp.status_code == 201
        session = session_resp.json()

        # Send complex request that might trigger iterations
        # Using a syntax-error prone request to potentially trigger retries
        message_resp = await client.post(
            f"/sessions/{session['id']}/messages",
            json={
                "prompt": "Add a new SpanishAgent class that translates messages to Spanish"
            },
        )
        assert message_resp.status_code == 200
        result = message_resp.json()

        # Check logs for iteration info
        log_text = caplog.text
        iteration_count = log_text.count("Running VibeCoder iteration")

        print("Running: complex vibecode request")
        print(f"Iterations: {iteration_count}")
        print(f"Result: success={not bool(result.get('error'))}")

        assert iteration_count <= 3, "Should not exceed 3 iterations"
        assert iteration_count >= 1, "Should have at least 1 iteration"

        # Verify we got a result (either diff or error)
        assert (
            result.get("diff_id") or result.get("patch") or result.get("error")
        ), "Should have some result"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_diff_creation_flow(test_server: dict) -> None:
    """Test complete diff creation and retrieval flow"""

    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    if not os.environ["OPENAI_API_KEY"]:
        pytest.skip("OPENAI_API_KEY not set")

    async with httpx.AsyncClient(base_url=test_server["url"], timeout=120.0) as client:
        # Create project with initial code
        project_resp = await client.post(
            "/projects", json={"name": "Diff Test Project"}
        )
        assert project_resp.status_code == 201
        project = project_resp.json()

        # Create session
        session_resp = await client.post(f"/projects/{project['id']}/sessions")
        assert session_resp.status_code == 201
        session = session_resp.json()

        # Send simple change request
        message_resp = await client.post(
            f"/sessions/{session['id']}/messages",
            json={
                "prompt": "Add a comment saying 'Hello World' at the end of the file"
            },
        )
        assert message_resp.status_code == 200
        result = message_resp.json()

        # Should get a diff
        assert result.get("diff_id") is not None, "Should create a diff"

        # Get the specific diff
        diff_resp = await client.get(f"/diffs/{result['diff_id']}")
        assert diff_resp.status_code == 200
        diff = diff_resp.json()

        # Verify diff structure
        assert diff["id"] == result["diff_id"]
        assert diff["status"] == "evaluator_approved"
        assert diff.get("commit_message"), "Should have commit message"
        assert diff.get("evaluator_reasoning"), "Should have reasoning"
        assert diff.get("diff_content"), "Should have diff content"

        # Get pending diffs for session
        pending_resp = await client.get(f"/diffs/sessions/{session['id']}/pending")
        assert pending_resp.status_code == 200
        pending_diffs = pending_resp.json()

        # Should include our diff
        diff_ids = [d["id"] for d in pending_diffs]
        assert result["diff_id"] in diff_ids

        print("Diff creation test:")
        print(f"  Created diff: {result['diff_id']}")
        print(f"  Status: {diff['status']}")
        print(f"  Commit message: {diff.get('commit_message', 'N/A')}")
        print(f"  Pending diffs count: {len(pending_diffs)}")


@pytest.mark.integration
def test_real_openai_api_key_required() -> None:
    """Verify that tests use real OpenAI API key"""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        pytest.skip(
            "OPENAI_API_KEY not set - this is expected if not running full tests"
        )

    # Should not be a mock key
    assert not api_key.startswith("mock"), "Must use real OpenAI API key, not mock"
    assert len(api_key) > 20, "API key seems too short"
    print(f"Using OpenAI API key: {api_key[:10]}...")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_socket_io_streaming(test_server: dict) -> None:
    """Test that AI responses are streamed via Socket.io in real-time"""
    # This would require Socket.io client to fully test
    # For now, we just verify the endpoints work

    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    if not os.environ["OPENAI_API_KEY"]:
        pytest.skip("OPENAI_API_KEY not set")

    async with httpx.AsyncClient(base_url=test_server["url"], timeout=120.0) as client:
        # Create project
        project_resp = await client.post("/projects", json={"name": "Stream Test"})
        assert project_resp.status_code == 201
        project = project_resp.json()

        # Create session
        session_resp = await client.post(f"/projects/{project['id']}/sessions")
        assert session_resp.status_code == 201
        session = session_resp.json()

        # Send message (Socket.io events would be emitted)
        message_resp = await client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "Add a docstring to the class"},
        )
        assert message_resp.status_code == 200

        # In a real test, we'd connect a Socket.io client and verify events
        print("Socket.io streaming test completed (manual verification needed)")
