"""
Test to verify that final_output contains the correct types according to OpenAI Agents SDK spec
"""

import asyncio
import os
import sys
from pathlib import Path

# Add app to Python path
sys.path.append(str(Path(__file__).parent))


async def test_final_output_types():
    """Test that final_output contains correct types per OpenAI Agents SDK spec"""

    print("🧪 Testing final_output types according to OpenAI Agents SDK specification")

    # Enable mocks
    os.environ["USE_OPENAI_MOCKS"] = "true"

    from app.mocks.openai_agents_sdk import MockAgent, MockRunner

    # Test 1: Agent without output_type should have string final_output for text responses
    print("\n--- Test 1: VibeCoder (no output_type) text response ---")

    vibecoder_agent = MockAgent(
        name="Vibecoder",
        model="gpt-4o-mini",
        instructions="Test agent with no output_type",
        tools=["submit_patch"],
    )

    # Force text response scenario
    from app.mocks.openai_agents_sdk import MockScenarios

    MockRunner.force_scenario = MockScenarios.TEXT_RESPONSE_MODE

    result = MockRunner.run_streamed(vibecoder_agent, "What does this code do?")

    events = []
    async for event in result.stream_events():
        events.append(event)

    print(f"✓ final_output type: {type(result.final_output)}")
    print(f"✓ final_output value: {result.final_output}")
    print(f"✓ Is string: {isinstance(result.final_output, str)}")

    assert isinstance(
        result.final_output, str
    ), f"Expected string, got {type(result.final_output)}"
    assert (
        result.final_output is not None
    ), "final_output should not be None for text responses"

    # Test 2: Agent without output_type should have None final_output for tool call scenarios
    print("\n--- Test 2: VibeCoder (no output_type) patch scenario ---")

    MockRunner.force_scenario = MockScenarios.COMMENT_ADDITION_APPROVED

    result = MockRunner.run_streamed(vibecoder_agent, "Add a comment")

    events = []
    async for event in result.stream_events():
        events.append(event)

    print(f"✓ final_output type: {type(result.final_output)}")
    print(f"✓ final_output value: {result.final_output}")
    print(f"✓ Is None: {result.final_output is None}")

    # For patch scenarios, VibeCoder (no output_type) should have None final_output
    # The EvaluationResult comes from the tool output mechanism
    assert result.final_output is None, f"Expected None, got {result.final_output}"

    # Test 3: Verify that evaluation results are captured via tool outputs, not final_output
    print("\n--- Test 3: Evaluation results in tool outputs ---")

    evaluation_found = False
    for event in events:
        if (
            hasattr(event, "item")
            and hasattr(event.item, "output")
            and hasattr(event.item.output, "approved")
        ):
            print(f"✓ Found evaluation in tool output: {event.item.output}")
            print(f"✓ Evaluation type: {type(event.item.output)}")
            print(f"✓ Has approved field: {hasattr(event.item.output, 'approved')}")
            print(f"✓ Has reasoning field: {hasattr(event.item.output, 'reasoning')}")
            print(
                f"✓ Has commit_message field: {hasattr(event.item.output, 'commit_message')}"
            )
            evaluation_found = True
            break

    assert evaluation_found, "Should find evaluation result in tool outputs"

    # Clean up
    MockRunner.force_scenario = None

    print("\n🎉 All final_output type tests passed!")
    print("\n📋 Summary:")
    print("✅ Text responses: final_output = string (correct per SDK spec)")
    print(
        "✅ Patch scenarios: final_output = None, evaluation via tool output (correct per SDK spec)"
    )
    print("✅ EvaluationResult properly captured via tool output mechanism")


if __name__ == "__main__":
    asyncio.run(test_final_output_types())
