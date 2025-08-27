"""
Simple integration test for mock system without full dependencies
"""

import asyncio
import os
import sys
from pathlib import Path

# Add app to Python path
sys.path.append(str(Path(__file__).parent))


async def test_mock_integration():
    """Test that mock integration works end-to-end"""

    # Enable mocks
    os.environ["USE_OPENAI_MOCKS"] = "true"

    # Import after setting environment variable
    from app.agents.all_agents import EvaluationResult
    from app.mocks.openai_agents_sdk import MockAgent, MockRunner

    print("✓ Mock imports successful")

    # Create a simple agent
    agent = MockAgent(
        name="Vibecoder",
        model="gpt-4o-mini",
        instructions="Test agent",
        tools=["submit_patch"],
    )

    # Test streaming
    print("Testing streaming mock...")
    result = MockRunner.run_streamed(agent, "Add a comment to this code")

    events = []
    async for event in result.stream_events():
        events.append(event)
        print(f"  Event: {event.type}")
        if hasattr(event, "name"):
            print(f"    Name: {event.name}")

    print(f"✓ Collected {len(events)} events")
    print(f"✓ Final output: {type(result.final_output)}")
    print(f"✓ Is complete: {result.is_complete}")

    # Verify structure
    assert len(events) >= 2, f"Expected at least 2 events, got {len(events)}"
    assert (
        events[0].type == "agent_updated_stream_event"
    ), f"First event should be agent_updated, got {events[0].type}"
    assert result.is_complete, "Result should be marked as complete"
    assert isinstance(
        result.final_output, EvaluationResult
    ), f"Final output should be EvaluationResult, got {type(result.final_output)}"

    print("✓ All assertions passed")

    # Test non-streaming
    print("Testing non-streaming mock...")
    response = await MockRunner.run(agent, "What does this code do?")

    print(f"✓ Response ID: {response.id}")
    print(f"✓ Response complete: {response.is_complete}")
    print(f"✓ Final output type: {type(response.final_output)}")

    assert response.is_complete, "Response should be marked as complete"
    assert response.final_output is not None, "Response should have final output"

    print("✓ Non-streaming test passed")

    # Test text response scenario
    print("Testing text response scenario...")
    result = MockRunner.run_streamed(agent, "What does this function do?")

    events = []
    async for event in result.stream_events():
        events.append(event)

    assert isinstance(
        result.final_output, str
    ), f"Text response should be string, got {type(result.final_output)}"
    print(f"✓ Text response: {result.final_output[:50]}...")

    print("\n🎉 All mock integration tests passed!")


if __name__ == "__main__":
    asyncio.run(test_mock_integration())
