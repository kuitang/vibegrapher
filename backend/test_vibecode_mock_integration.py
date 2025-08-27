"""
Test integration of mock system with actual vibecode service
"""

import asyncio
import os
import sys
from pathlib import Path

# Add app to Python path
sys.path.append(str(Path(__file__).parent))


async def test_vibecode_service_with_mocks():
    """Test that vibecode service works with mock OpenAI calls"""

    # Enable mocks
    os.environ["USE_OPENAI_MOCKS"] = "true"

    # Import after setting environment variable
    from app.agents.all_agents import VibecodeResult, vibecode_service
    from app.mocks import get_runner_class

    print("✓ Imports successful")

    # Verify that Runner class is now MockRunner
    runner_class = get_runner_class()
    print(f"✓ Using Runner class: {runner_class.__name__}")

    # Test vibecode service call
    print("Testing vibecode service with mocks...")

    current_code = """# Welcome to Vibegrapher
# Project: Test

def main():
    print("Ready for vibecoding!")

if __name__ == "__main__":
    main()
"""

    try:
        result = await vibecode_service.vibecode(
            project_id="test-project",
            prompt="Add a comment explaining what the main function does",
            current_code=current_code,
            project_slug="test-project",
            session_id="test-session-123",
        )

        print(f"✓ Vibecode result type: {type(result)}")
        print(f"✓ Has diff_id: {result.diff_id is not None}")
        print(f"✓ Has content: {result.content is not None}")
        print(f"✓ Has messages: {len(result.messages) if result.messages else 0}")
        print(f"✓ Has openai_response: {result.openai_response is not None}")

        # Check that we got a successful result
        assert isinstance(
            result, VibecodeResult
        ), f"Expected VibecodeResult, got {type(result)}"

        # For successful patch scenarios, we should get a diff_id
        if result.diff_id:
            print(f"✓ Success case - got diff_id: {result.diff_id}")
            assert result.messages, "Should have collected messages"
            print(f"✓ Message count: {len(result.messages)}")

            # Check message structure
            for i, msg in enumerate(result.messages[:3]):  # Check first 3 messages
                print(
                    f"  Message {i}: {msg.get('message_type')} - {msg.get('stream_event_type')}"
                )

        elif result.content:
            print(f"✓ Text response case - got content: {result.content[:50]}...")
            assert result.messages, "Should have collected messages"

        print("✓ Vibecode service integration test passed!")

        return result

    except Exception as e:
        print(f"❌ Error in vibecode service: {e}")
        import traceback

        traceback.print_exc()
        raise


async def test_multiple_scenarios():
    """Test multiple different input scenarios"""

    os.environ["USE_OPENAI_MOCKS"] = "true"

    from app.agents.all_agents import vibecode_service

    current_code = """def calculate(a, b):
    return a + b
"""

    # Test different scenarios
    scenarios = [
        ("Add a comment", "patch"),
        ("What does this function do?", "text"),
        ("Add a docstring to explain the function", "patch"),
        ("Explain how this code works", "text"),
    ]

    print("\nTesting multiple scenarios...")

    for prompt, expected_type in scenarios:
        print(f"\n--- Testing: {prompt} ---")

        result = await vibecode_service.vibecode(
            project_id="test-project",
            prompt=prompt,
            current_code=current_code,
            project_slug="test-project",
            session_id=f"test-session-{hash(prompt)}",
        )

        if expected_type == "patch":
            if result.diff_id:
                print("✓ Got patch result as expected")
            else:
                print(f"⚠️  Expected patch but got text response: {result.content}")
        else:  # text
            if result.content:
                print("✓ Got text response as expected")
            else:
                print("⚠️  Expected text but got patch result")

    print("✓ Multiple scenario test completed")


async def test_mock_event_persistence():
    """Test that mock events are properly structured for database persistence"""

    os.environ["USE_OPENAI_MOCKS"] = "true"

    from app.agents.all_agents import vibecode_service

    current_code = "def test(): pass"

    result = await vibecode_service.vibecode(
        project_id="test-project",
        prompt="Add a comment",
        current_code=current_code,
        project_slug="test-project",
        session_id="persistence-test",
    )

    print("\nTesting event persistence structure...")

    # Check message structure for database compatibility
    if result.messages:
        msg = result.messages[0]
        required_fields = [
            "id",
            "session_id",
            "role",
            "message_type",
            "stream_event_type",
            "stream_sequence",
            "iteration",
            "created_at",
            "event_data",
        ]

        for field in required_fields:
            assert field in msg, f"Missing required field: {field}"
            print(f"✓ Has {field}: {type(msg[field])}")

        # Test JSON serialization (for database storage)
        import json

        try:
            json.dumps(msg["event_data"])
            print("✓ Event data is JSON serializable")
        except Exception as e:
            print(f"❌ Event data serialization failed: {e}")
            raise

    print("✓ Event persistence structure test passed")


if __name__ == "__main__":

    async def main():
        await test_vibecode_service_with_mocks()
        await test_multiple_scenarios()
        await test_mock_event_persistence()
        print("\n🎉 All vibecode mock integration tests passed!")

    asyncio.run(main())
