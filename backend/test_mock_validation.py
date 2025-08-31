"""
Comprehensive validation test for mock system
Collects evidence for comparison with validated test evidence
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add app to Python path
sys.path.append(str(Path(__file__).parent))


async def main():
    """Run comprehensive mock validation test"""

    print("🧪 Starting comprehensive mock validation test")
    print(f"📅 Test run at: {datetime.now().isoformat()}")

    # Enable mocks
    os.environ["USE_OPENAI_MOCKS"] = "true"

    # Import after setting environment
    from app.agents.all_agents import vibecode_service

    # Test data collection
    test_results = {
        "test_timestamp": datetime.now().isoformat(),
        "mock_enabled": True,
        "test_scenarios": [],
    }

    # Test scenarios
    scenarios = [
        {
            "name": "comment_addition_patch",
            "prompt": "Add a comment explaining what this function does",
            "current_code": """def calculate_total(items):
    return sum(item.price for item in items)""",
            "expected_type": "patch",
        },
        {
            "name": "explain_code_text",
            "prompt": "What does this function do?",
            "current_code": """def process_data(data):
    cleaned = [x.strip() for x in data if x]
    return sorted(cleaned)""",
            "expected_type": "text",
        },
        {
            "name": "add_docstring_patch",
            "prompt": "Add a docstring to this function",
            "current_code": """def validate_email(email):
    return '@' in email and '.' in email""",
            "expected_type": "patch",
        },
    ]

    print(f"\n📋 Running {len(scenarios)} test scenarios...")

    for i, scenario in enumerate(scenarios, 1):
        print(f"\n--- Scenario {i}: {scenario['name']} ---")
        print(f"Prompt: {scenario['prompt']}")
        print(f"Expected: {scenario['expected_type']}")

        try:
            # Run vibecode service
            result = await vibecode_service.vibecode(
                project_id=f"test-{scenario['name']}",
                prompt=scenario["prompt"],
                current_code=scenario["current_code"],
                project_slug=f"test-{scenario['name']}",
                session_id=f"session-{scenario['name']}-{int(datetime.now().timestamp())}",
            )

            # Analyze result
            got_type = "patch" if result.diff_id else "text"
            success = got_type == scenario["expected_type"]

            print(f"✓ Result type: {got_type}")
            print(f"✓ Expected match: {success}")
            print(
                f"✓ Messages collected: {len(result.messages) if result.messages else 0}"
            )

            # Collect detailed result data
            scenario_result = {
                "scenario": scenario["name"],
                "prompt": scenario["prompt"],
                "expected_type": scenario["expected_type"],
                "actual_type": got_type,
                "success": success,
                "diff_id": result.diff_id,
                "content_preview": result.content[:100] if result.content else None,
                "message_count": len(result.messages) if result.messages else 0,
                "openai_response_present": result.openai_response is not None,
                "messages": [],
            }

            # Collect message details (first 3 messages)
            if result.messages:
                for msg in result.messages[:3]:
                    message_summary = {
                        "id": msg.get("id"),
                        "message_type": msg.get("message_type"),
                        "stream_event_type": msg.get("stream_event_type"),
                        "stream_sequence": msg.get("stream_sequence"),
                        "has_tool_calls": bool(msg.get("tool_calls")),
                        "has_tool_outputs": bool(msg.get("tool_outputs")),
                        "has_event_data": bool(msg.get("event_data")),
                    }
                    scenario_result["messages"].append(message_summary)

            test_results["test_scenarios"].append(scenario_result)

        except Exception as e:
            print(f"❌ Scenario failed: {e}")
            scenario_result = {
                "scenario": scenario["name"],
                "prompt": scenario["prompt"],
                "expected_type": scenario["expected_type"],
                "error": str(e),
                "success": False,
            }
            test_results["test_scenarios"].append(scenario_result)

    # Test data structure compatibility
    print("\n🔍 Testing data structure compatibility...")

    # Get a sample result for structure analysis
    sample_result = await vibecode_service.vibecode(
        project_id="structure-test",
        prompt="Add a comment",
        current_code="def test(): pass",
        project_slug="structure-test",
        session_id="structure-test-session",
    )

    if sample_result.messages:
        sample_message = sample_result.messages[0]

        # Test database field compatibility
        db_compatible_fields = [
            "id",
            "session_id",
            "role",
            "message_type",
            "stream_event_type",
            "stream_sequence",
            "iteration",
            "created_at",
            "event_data",
            "tool_calls",
            "tool_outputs",
            "handoffs",
        ]

        compatibility_check = {}
        for field in db_compatible_fields:
            has_field = field in sample_message
            compatibility_check[field] = {
                "present": has_field,
                "type": type(sample_message.get(field)).__name__ if has_field else None,
            }

        test_results["data_compatibility"] = compatibility_check

        # Test JSON serialization
        try:
            json.dumps(sample_message["event_data"])
            test_results["json_serializable"] = True
        except Exception as e:
            test_results["json_serializable"] = False
            test_results["serialization_error"] = str(e)

    # Calculate success metrics
    successful_scenarios = sum(
        1 for s in test_results["test_scenarios"] if s.get("success", False)
    )
    total_scenarios = len(test_results["test_scenarios"])
    success_rate = (
        (successful_scenarios / total_scenarios) * 100 if total_scenarios > 0 else 0
    )

    test_results["summary"] = {
        "total_scenarios": total_scenarios,
        "successful_scenarios": successful_scenarios,
        "success_rate_percent": success_rate,
        "all_passed": success_rate == 100,
    }

    # Save results
    output_dir = Path("validated_test_evidence/mock_system")
    output_dir.mkdir(parents=True, exist_ok=True)

    output_file = (
        output_dir
        / f"mock_validation_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )

    with open(output_file, "w") as f:
        json.dump(test_results, f, indent=2, default=str)

    print("\n📊 Test Results Summary:")
    print(f"✓ Total scenarios: {total_scenarios}")
    print(f"✓ Successful: {successful_scenarios}")
    print(f"✓ Success rate: {success_rate:.1f}%")
    print(f"✓ JSON serializable: {test_results.get('json_serializable', False)}")
    print(f"✓ Results saved to: {output_file}")

    if success_rate == 100:
        print("\n🎉 All tests passed! Mock system is fully operational.")
    else:
        print("\n⚠️  Some tests failed. Check results for details.")

    return test_results


if __name__ == "__main__":
    results = asyncio.run(main())
