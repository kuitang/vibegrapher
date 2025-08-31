"""
Mock OpenAI Agents SDK Implementation

Provides realistic streaming behavior that matches the exact structure
captured in production logs. All events and data structures maintain
100% fidelity with the real OpenAI Agents SDK.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime
from typing import Any, ClassVar
from uuid import uuid4

from agents.run_context import RunContextWrapper

# Import the actual classes we're mocking
from agents.stream_events import (
    AgentUpdatedStreamEvent,
    RunItemStreamEvent,
    StreamEvent,
)
from agents.usage import Usage
from openai.types.responses import Response
from openai.types.responses.response_usage import (
    InputTokensDetails,
    OutputTokensDetails,
    ResponseUsage,
)

# Import will be done dynamically to avoid circular import


logger = logging.getLogger(__name__)


@dataclass
class MockAgent:
    """Mock Agent matching production structure"""

    name: str
    model: str
    instructions: str
    tools: list[str]
    _type: str = "Agent"


class MockToolCallItem:
    """Mock ToolCallItem with raw_item structure"""

    def __init__(
        self, call_id: str, name: str, arguments: str, status: str = "completed"
    ):
        self.raw_item = {
            "arguments": arguments,
            "call_id": call_id,
            "name": name,
            "type": "function_call",
            "id": f"fc_{call_id}",
            "status": status,
        }
        self.agent = None  # Will be set by mock
        self.type = "tool_call_item"


class MockToolCallOutputItem:
    """Mock ToolCallOutputItem with evaluation results"""

    def __init__(self, call_id: str, output_data):
        self.raw_item = {
            "call_id": call_id,
            "output": str(output_data),  # Serialized evaluation
            "type": "function_call_output",
        }
        self.output = output_data  # Structured evaluation result
        self.agent = None
        self.type = "tool_call_output_item"


class MockMessageOutputItem:
    """Mock MessageOutputItem for text responses"""

    def __init__(self, content: str):
        # Create structure that matches what production code expects
        class MockContentItem:
            def __init__(self, text):
                self.text = text

        class MockRawItem:
            def __init__(self, content_text):
                self.content = [MockContentItem(content_text)]
                self.type = "message"

        self.raw_item = MockRawItem(content)
        self.content = content
        self.agent = None
        self.type = "message_output_item"


class MockScenarios:
    """Pre-defined scenarios based on logged interactions"""

    COMMENT_ADDITION_APPROVED: ClassVar[dict[str, Any]] = {
        "name": "comment_addition_approved",
        "description": "User requests adding a comment, approved on first try",
        "events": [
            {"type": "agent_updated", "delay": 0.0},
            {
                "type": "tool_called",
                "name": "submit_patch",
                "patch": "@@ -1,6 +1,7 @@\n # Welcome to Vibegrapher\n # Project: Test\n+\n+# Added explanatory comment\n def main():",
                "description": "Added explanatory comment",
                "delay": 2.0,
            },
            {
                "type": "tool_output",
                "approved": True,
                "reasoning": "Good addition of clarifying comment that improves code readability",
                "commit_message": "Add explanatory comment to improve code clarity",
                "delay": 1.0,
            },
        ],
    }

    COMMENT_ADDITION_REJECTED_THEN_APPROVED: ClassVar[dict[str, Any]] = {
        "name": "comment_addition_rejected_then_approved",
        "description": "User requests adding comment, rejected first, approved second",
        "events": [
            {"type": "agent_updated", "delay": 0.0},
            {
                "type": "tool_called",
                "name": "submit_patch",
                "patch": "@@ -1,6 +1,7 @@\n # Welcome to Vibegrapher\n # Project: Test\n+\n def main():",
                "description": "Added a blank line",
                "delay": 2.0,
            },
            {
                "type": "tool_output",
                "approved": False,
                "reasoning": "The patch adds a blank line but doesn't add meaningful commentary as requested",
                "commit_message": "Error: Add actual comment content, not just whitespace",
                "delay": 1.0,
            },
            {
                "type": "tool_called",
                "name": "submit_patch",
                "patch": "@@ -1,6 +1,8 @@\n # Welcome to Vibegrapher\n # Project: Test\n+\n+# This function initializes the application\n def main():",
                "description": "Added explanatory comment about main function",
                "delay": 2.0,
            },
            {
                "type": "tool_output",
                "approved": True,
                "reasoning": "Good addition of meaningful comment that explains the function's purpose",
                "commit_message": "Add explanatory comment for main function",
                "delay": 1.0,
            },
        ],
    }

    TEXT_RESPONSE_MODE: ClassVar[dict[str, Any]] = {
        "name": "text_response_mode",
        "description": "User asks a question, gets text response",
        "events": [
            {"type": "agent_updated", "delay": 0.0},
            {
                "type": "message_output",
                "content": "This code defines a simple Python application with a main function that prints 'Ready for vibecoding!' when executed.",
                "delay": 1.5,
            },
        ],
    }

    @classmethod
    def get_scenario_for_input(cls, user_input: str) -> dict[str, Any]:
        """Select scenario based on user input patterns"""
        input_lower = user_input.lower()

        # Check for text response patterns first (questions)
        if (
            ("what does" in input_lower and "?" in user_input)
            or ("explain" in input_lower and "?" in user_input)
            or ("how does" in input_lower and "?" in user_input)
        ):
            return cls.TEXT_RESPONSE_MODE

        # Check for patch patterns (modification requests)
        elif any(
            word in input_lower
            for word in ["add", "create", "insert", "modify", "change", "update", "fix"]
        ):
            # Determine if it should be approved or rejected first
            if "comment" in input_lower or "docstring" in input_lower:
                # 70% chance of approval, 30% chance of rejection then approval
                import random

                if random.random() < 0.7:
                    return cls.COMMENT_ADDITION_APPROVED
                else:
                    return cls.COMMENT_ADDITION_REJECTED_THEN_APPROVED
            else:
                return cls.COMMENT_ADDITION_APPROVED
        else:
            # Default to text response for unclear requests
            return cls.TEXT_RESPONSE_MODE


class MockEventFactory:
    """Factory for creating realistic mock events with proper data structures"""

    @staticmethod
    def create_agent_updated_event() -> AgentUpdatedStreamEvent:
        """Create agent updated event matching logged structure"""
        mock_agent = MockAgent(
            name="Vibecoder",
            model="gpt-4o-mini",
            instructions="You are VibeCoder, an expert Python developer who helps modify code.\n\nYou have TWO response modes:\n\n1. PATCH MODE: When the user asks to modify, add, or change code, use the submit_patch tool.\n   - Generate a unified diff patch in proper format...",
            tools=["submit_patch"],
        )

        return AgentUpdatedStreamEvent(
            new_agent=mock_agent, type="agent_updated_stream_event"
        )

    @staticmethod
    def create_tool_call_event(
        call_id: str, patch_content: str, description: str
    ) -> RunItemStreamEvent:
        """Create tool call event with realistic patch data"""
        arguments = json.dumps({"patch": patch_content, "description": description})

        tool_call = MockToolCallItem(
            call_id=call_id, name="submit_patch", arguments=arguments
        )
        tool_call.agent = MockEventFactory._get_mock_agent()

        return RunItemStreamEvent(
            name="tool_called", item=tool_call, type="run_item_stream_event"
        )

    @staticmethod
    def create_tool_output_event(
        call_id: str, approved: bool, reasoning: str, commit_message: str
    ) -> RunItemStreamEvent:
        """Create tool output event with EvaluationResult (what the function actually returns)"""
        # Import EvaluationResult from the agents module (where it's actually used)
        from ..agents.all_agents import EvaluationResult

        # The submit_patch function returns an EvaluationResult object
        evaluation_result = EvaluationResult(
            approved=approved, reasoning=reasoning, commit_message=commit_message
        )

        tool_output = MockToolCallOutputItem(
            call_id=call_id,
            output_data=evaluation_result,  # EvaluationResult object (what function returns)
        )
        tool_output.agent = MockEventFactory._get_mock_agent()

        return RunItemStreamEvent(
            name="tool_output", item=tool_output, type="run_item_stream_event"
        )

    @staticmethod
    def create_message_output_event(content: str) -> RunItemStreamEvent:
        """Create message output event for text responses"""
        message_item = MockMessageOutputItem(content=content)
        message_item.agent = MockEventFactory._get_mock_agent()

        return RunItemStreamEvent(
            name="message_output", item=message_item, type="run_item_stream_event"
        )

    @staticmethod
    def _get_mock_agent() -> MockAgent:
        """Get standard mock agent"""
        return MockAgent(
            name="Vibecoder",
            model="gpt-4o-mini",
            instructions="You are VibeCoder, an expert Python developer who helps modify code.\n\nYou have TWO response modes:\n\n1. PATCH MODE: When the user asks to modify, add, or change code, use the submit_patch tool.\n   - Generate a unified diff patch in proper format...",
            tools=["submit_patch"],
        )


class MockRunResultStreaming:
    """Mock implementation of RunResultStreaming matching real agents SDK structure"""

    def __init__(
        self, agent: Any, input_prompt: str, event_sequence: dict, session: Any
    ):
        self.current_agent = agent
        self.input_prompt = input_prompt
        self.event_sequence = event_sequence
        self.session = session
        self.is_complete = False
        self.final_output = None
        self.response_id = f"mock_response_{uuid4().hex[:8]}"

        # Add real agents SDK fields
        self.input = input_prompt
        self.new_items = []
        self.raw_responses = []
        self.current_turn = 0
        self.max_turns = 10
        self.trace = None

        # Create context_wrapper with usage (what vibecode_service checks for)
        usage = Usage(
            requests=1,
            input_tokens=250 + len(input_prompt.split()),
            output_tokens=150,
            total_tokens=400 + len(input_prompt.split()),
        )
        self.context_wrapper = RunContextWrapper(context=session, usage=usage)

    async def stream_events(self) -> AsyncIterator[StreamEvent]:
        """Stream mock events in realistic sequence with timing"""

        sequence_num = 0

        # Track iterations (important for evaluator iteration tests)
        self.current_turn = 1

        # 1. Agent Updated Event
        yield MockEventFactory.create_agent_updated_event()
        await asyncio.sleep(0.1)

        # 2. Stream events based on scenario
        for event_spec in self.event_sequence["events"]:
            sequence_num += 1

            if event_spec["type"] == "agent_updated":
                # Already emitted above
                continue

            elif event_spec["type"] == "tool_called":
                # Create and emit tool call event
                tool_call_event = MockEventFactory.create_tool_call_event(
                    call_id=f"call_{sequence_num}",
                    patch_content=event_spec.get("patch", ""),
                    description=event_spec.get("description", ""),
                )

                # Store tool call in new_items (for diff content extraction)
                self.new_items.append(tool_call_event.item)

                yield tool_call_event

                # Simulate processing delay
                await asyncio.sleep(event_spec.get("delay", 0.1))

            elif event_spec["type"] == "tool_output":
                # Create and emit tool output event
                tool_output_event = MockEventFactory.create_tool_output_event(
                    call_id=f"call_{sequence_num-1}",  # Match previous call
                    approved=event_spec.get("approved", False),
                    reasoning=event_spec.get("reasoning", "Mock reasoning"),
                    commit_message=event_spec.get("commit_message", "Mock commit"),
                )

                # Store tool output in new_items (for evaluation result extraction)
                self.new_items.append(tool_output_event.item)

                yield tool_output_event

                # For patch scenarios, VibeCoder's final_output should be None or empty
                # The EvaluationResult is captured through tool output mechanism, not final_output
                # VibeCoder agent has no output_type, so final_output should be None for tool scenarios
                if event_spec.get("approved"):
                    self.final_output = None  # VibeCoder agent has no output_type

                await asyncio.sleep(event_spec.get("delay", 0.1))

            elif event_spec["type"] == "message_output":
                # Create and emit message output event
                message_event = MockEventFactory.create_message_output_event(
                    content=event_spec.get("content", "Mock text response")
                )

                yield message_event

                # Set final output for text responses - should be a STRING for agents without output_type
                self.final_output = event_spec.get("content", "Mock text response")

                await asyncio.sleep(event_spec.get("delay", 0.1))

        # Mark complete
        self.is_complete = True


class MockRunner:
    """Mock implementation of agents.Runner"""

    force_scenario = None  # Allow forcing specific scenarios for testing

    def __init__(self):
        self._sequence_counter = 0

    @classmethod
    def run_streamed(
        cls, starting_agent: Any, input_prompt: str, session: Any = None, **kwargs
    ) -> MockRunResultStreaming:
        """Mock implementation of Runner.run_streamed()"""
        logger.info(
            f"MockRunner.run_streamed called with prompt: {input_prompt[:50]}..."
        )

        runner = cls()
        return runner._create_streaming_result(starting_agent, input_prompt, session)

    @classmethod
    async def run(
        cls, starting_agent: Any, input_prompt: str, session: Any = None, **kwargs
    ) -> Response:
        """Mock implementation of Runner.run() (non-streaming)"""
        logger.info(f"MockRunner.run called with prompt: {input_prompt[:50]}...")

        # Use streaming implementation and collect all events
        streaming_result = cls.run_streamed(
            starting_agent, input_prompt, session, **kwargs
        )

        events = []
        async for event in streaming_result.stream_events():
            events.append(event)

        # Create response with realistic token usage using real OpenAI SDK types
        input_tokens = 250 + len(input_prompt.split())
        output_tokens = 150
        usage = ResponseUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            input_tokens_details=InputTokensDetails(cached_tokens=0),
            output_tokens_details=OutputTokensDetails(reasoning_tokens=0),
        )

        # Use the actual OpenAI Response class with all fields from real traces
        response = Response(
            id=streaming_result.response_id,
            created_at=datetime.now().timestamp(),
            model=(
                starting_agent.model
                if hasattr(starting_agent, "model")
                else "gpt-4o-mini"
            ),
            object="response",
            status="completed",
            instructions="",
            output=[],  # Required field
            parallel_tool_calls=True,
            tools=[],  # Required field
            tool_choice="auto",  # Required field from traces
            temperature=1.0,
            top_p=1.0,
            usage=usage,
            # Optional fields from traces
            error=None,
            incomplete_details=None,
            metadata={},
            background=False,
            conversation=None,
            max_output_tokens=None,
            max_tool_calls=None,
            previous_response_id=None,
            prompt=None,
            prompt_cache_key=None,
            reasoning={"effort": None, "generate_summary": None, "summary": None},
            safety_identifier=None,
            service_tier="auto",
            text={"format": {"type": "text"}, "verbosity": "medium"},
            top_logprobs=0,
            truncation="disabled",
            user=None,
            store=True,
        )

        # Add custom attributes that our code expects
        response.final_output = streaming_result.final_output  # type: ignore
        response.is_complete = streaming_result.is_complete  # type: ignore
        response.new_items = streaming_result.new_items  # type: ignore - for diff content extraction
        response.context_wrapper = streaming_result.context_wrapper  # type: ignore - for token usage

        return response

    def _create_streaming_result(
        self, agent: Any, input_prompt: str, session: Any
    ) -> MockRunResultStreaming:
        """Create a mock streaming result that yields realistic events"""

        # Use forced scenario if set, otherwise select based on input
        if self.force_scenario:
            sequence = self.force_scenario
        else:
            sequence = MockScenarios.get_scenario_for_input(input_prompt)

        logger.info(f"Using mock scenario: {sequence['name']}")

        return MockRunResultStreaming(
            agent=agent,
            input_prompt=input_prompt,
            event_sequence=sequence,
            session=session,
        )
