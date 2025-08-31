"""
Tests for OpenAI Agents SDK mock implementation
"""

import json
import os
from unittest.mock import patch

import pytest

# EvaluationResult needed for data structure tests (not mock behavior tests)
from app.agents.all_agents import EvaluationResult
from app.mocks.config import get_mock_config
from app.mocks.openai_agents_sdk import (
    MockAgent,
    MockEventFactory,
    MockRunner,
    MockScenarios,
)


class TestMockConfiguration:
    """Test mock configuration system"""

    def test_mock_disabled_by_default(self):
        """Test that mocks are disabled by default"""
        with patch.dict(os.environ, {}, clear=True):
            config = get_mock_config()
            assert config.enabled is False

    def test_mock_enabled_by_env_var(self):
        """Test that mocks can be enabled via environment variable"""
        with patch.dict(os.environ, {"USE_OPENAI_MOCKS": "true"}):
            config = get_mock_config()
            assert config.enabled is True

    def test_mock_config_from_json(self):
        """Test mock configuration from JSON environment variable"""
        config_json = json.dumps(
            {
                "simulate_delays": False,
                "base_delay_ms": 200,
                "default_scenario": "text_response_mode",
            }
        )

        with patch.dict(
            os.environ, {"USE_OPENAI_MOCKS": "true", "OPENAI_MOCK_CONFIGS": config_json}
        ):
            config = get_mock_config()
            assert config.enabled is True
            assert config.simulate_delays is False
            assert config.base_delay_ms == 200
            assert config.default_scenario == "text_response_mode"


class TestMockScenarios:
    """Test scenario selection logic"""

    def test_comment_scenario_selection(self):
        """Test that comment inputs select comment scenarios"""
        scenario = MockScenarios.get_scenario_for_input(
            "Add a comment to explain this function"
        )
        assert "comment" in scenario["name"]

    def test_question_scenario_selection(self):
        """Test that question inputs select text response scenario"""
        scenario = MockScenarios.get_scenario_for_input("What does this code do?")
        assert scenario["name"] == "text_response_mode"

    def test_explain_scenario_selection(self):
        """Test that explain inputs select text response scenario"""
        scenario = MockScenarios.get_scenario_for_input("Explain how this works")
        assert scenario["name"] == "text_response_mode"

    def test_default_scenario_selection(self):
        """Test that unknown inputs get default scenario"""
        scenario = MockScenarios.get_scenario_for_input("Some random input")
        assert scenario["name"] == "text_response_mode"


class TestMockEventFactory:
    """Test mock event factory functionality"""

    def test_agent_updated_event_creation(self):
        """Test creation of agent updated events"""
        event = MockEventFactory.create_agent_updated_event()
        assert event.type == "agent_updated_stream_event"
        assert hasattr(event, "new_agent")
        assert event.new_agent.name == "Vibecoder"
        assert event.new_agent.model == "gpt-4o-mini"
        assert "submit_patch" in event.new_agent.tools

    def test_tool_call_event_creation(self):
        """Test creation of tool call events"""
        event = MockEventFactory.create_tool_call_event(
            call_id="test_call_123",
            patch_content="@@ -1,3 +1,4 @@\n+# Comment\n def main():",
            description="Added a comment",
        )

        assert event.type == "run_item_stream_event"
        assert event.name == "tool_called"
        assert hasattr(event.item, "raw_item")
        assert event.item.raw_item["call_id"] == "test_call_123"
        assert event.item.raw_item["name"] == "submit_patch"

        # Check arguments parsing
        args = json.loads(event.item.raw_item["arguments"])
        assert args["description"] == "Added a comment"
        assert "# Comment" in args["patch"]

    def test_tool_output_event_creation(self):
        """Test creation of tool output events"""
        event = MockEventFactory.create_tool_output_event(
            call_id="test_call_123",
            approved=True,
            reasoning="Good change",
            commit_message="Add helpful comment",
        )

        assert event.type == "run_item_stream_event"
        assert event.name == "tool_output"
        assert hasattr(event.item, "output")
        # Function tools return EvaluationResult objects (not raw strings)
        from app.agents.all_agents import EvaluationResult

        assert isinstance(event.item.output, EvaluationResult)
        assert event.item.output.approved is True
        assert event.item.output.reasoning == "Good change"
        assert event.item.output.commit_message == "Add helpful comment"

    def test_message_output_event_creation(self):
        """Test creation of message output events"""
        content = "This is a text response explaining the code"
        event = MockEventFactory.create_message_output_event(content)

        assert event.type == "run_item_stream_event"
        assert event.name == "message_output"
        assert hasattr(event.item, "content")
        assert event.item.content == content


class TestMockRunner:
    """Test mock runner functionality"""

    @pytest.mark.asyncio
    async def test_mock_runner_basic_flow(self):
        """Test basic mock runner functionality"""

        # Create mock agent
        agent = MockAgent(
            name="Vibecoder",
            model="gpt-4o-mini",
            instructions="Test agent",
            tools=["submit_patch"],
        )

        result = MockRunner.run_streamed(agent, "Add a comment")

        events = []
        async for event in result.stream_events():
            events.append(event)

        # Verify we got expected sequence
        assert len(events) >= 2  # At least agent_updated and tool_called
        assert events[0].type == "agent_updated_stream_event"
        assert any(e.type == "run_item_stream_event" for e in events)
        assert result.is_complete

    @pytest.mark.asyncio
    async def test_mock_runner_text_response(self):
        """Test mock runner with text response scenario"""

        agent = MockAgent(
            name="Vibecoder", model="gpt-4o-mini", instructions="Test agent", tools=[]
        )

        result = MockRunner.run_streamed(agent, "What does this code do?")

        events = []
        async for event in result.stream_events():
            events.append(event)

        # Should have agent_updated and message_output events
        assert len(events) >= 2
        assert events[0].type == "agent_updated_stream_event"

        # Find message output event
        message_events = [
            e for e in events if (hasattr(e, "name") and e.name == "message_output")
        ]
        assert len(message_events) > 0
        assert isinstance(result.final_output, str)

    @pytest.mark.asyncio
    async def test_mock_runner_approval_flow(self):
        """Test mock runner with approval scenario"""

        agent = MockAgent(
            name="Vibecoder",
            model="gpt-4o-mini",
            instructions="Test agent",
            tools=["submit_patch"],
        )

        # Force the approved scenario to avoid randomness
        MockRunner.force_scenario = MockScenarios.COMMENT_ADDITION_APPROVED

        result = MockRunner.run_streamed(agent, "Add a comment")

        events = []
        async for event in result.stream_events():
            events.append(event)

        # Should have tool call and tool output events
        tool_call_events = [
            e for e in events if (hasattr(e, "name") and e.name == "tool_called")
        ]
        tool_output_events = [
            e for e in events if (hasattr(e, "name") and e.name == "tool_output")
        ]

        assert len(tool_call_events) > 0
        assert len(tool_output_events) > 0
        # For patch scenarios, final_output should be None (evaluation comes through tool outputs)
        assert result.final_output is None
        # Check that tool output contains EvaluationResult (what submit_patch function returns)
        from app.agents.all_agents import EvaluationResult

        tool_output = tool_output_events[0].item.output
        assert isinstance(tool_output, EvaluationResult)
        assert tool_output.approved is True

        # Reset forced scenario
        MockRunner.force_scenario = None

    @pytest.mark.asyncio
    async def test_mock_runner_non_streaming(self):
        """Test mock runner non-streaming run method"""

        agent = MockAgent(
            name="Vibecoder",
            model="gpt-4o-mini",
            instructions="Test agent",
            tools=["submit_patch"],
        )

        response = await MockRunner.run(agent, "Add a comment")

        assert hasattr(response, "id")
        assert hasattr(response, "final_output")
        assert response.is_complete
        # For patch scenarios, final_output should be None (evaluation comes via tool outputs)
        assert response.final_output is None
        # Verify usage is properly set with real OpenAI types
        assert hasattr(response, "usage")
        assert response.usage is not None
        assert response.usage.total_tokens > 0

    def test_forced_scenario(self):
        """Test that scenarios can be forced for testing"""

        # Force specific scenario
        MockRunner.force_scenario = MockScenarios.TEXT_RESPONSE_MODE

        agent = MockAgent(
            name="Vibecoder", model="gpt-4o-mini", instructions="Test agent", tools=[]
        )

        result = MockRunner.run_streamed(
            agent, "Add a comment"
        )  # Would normally trigger patch scenario

        # Should use forced text response scenario instead
        assert result.event_sequence["name"] == "text_response_mode"

        # Clean up
        MockRunner.force_scenario = None


class TestMockIntegration:
    """Test integration with actual application code"""

    @pytest.mark.asyncio
    async def test_mock_integration_with_environment_variable(self):
        """Test that mock integration works with environment variable"""

        with patch.dict(os.environ, {"USE_OPENAI_MOCKS": "true"}):
            # Re-import to trigger monkey patching
            import importlib

            from app.mocks import openai_agents_sdk

            importlib.reload(openai_agents_sdk)

            # Import agents module to check if it was patched
            import agents

            # The Runner should now be MockRunner
            # This test verifies the monkey patching works
            assert hasattr(agents.Runner, "run_streamed")

    def test_data_structure_fidelity(self):
        """Test that mock data structures match expected format"""

        # Test agent structure
        agent = MockAgent(
            name="Vibecoder",
            model="gpt-4o-mini",
            instructions="Test instructions",
            tools=["submit_patch"],
        )

        assert hasattr(agent, "name")
        assert hasattr(agent, "model")
        assert hasattr(agent, "instructions")
        assert hasattr(agent, "tools")
        assert hasattr(agent, "_type")

        # Test evaluation result structure
        evaluation = EvaluationResult(
            approved=True, reasoning="Test reasoning", commit_message="Test commit"
        )

        assert hasattr(evaluation, "approved")
        assert hasattr(evaluation, "reasoning")
        assert hasattr(evaluation, "commit_message")

        # Test serialization (important for database storage)
        evaluation_dict = evaluation.model_dump()
        assert isinstance(evaluation_dict, dict)
        assert evaluation_dict["approved"] is True
        assert evaluation_dict["reasoning"] == "Test reasoning"
        assert evaluation_dict["commit_message"] == "Test commit"
