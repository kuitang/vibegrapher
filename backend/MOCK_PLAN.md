# OpenAI Agents SDK Mock Implementation Plan

## Executive Summary

This document provides a comprehensive plan for creating mock implementations of the OpenAI Agents SDK that will replicate the exact streaming behavior captured in our production logs. The mock system will allow testing without hitting real OpenAI APIs while maintaining identical data structures and event sequences.

## Analysis Summary

Based on analysis of the codebase and logs, we've identified:

### Key Evidence Sources:
1. **Database Analysis**: `/home/kuitang/git/vibegrapher/validated_test_evidence/phase1/database-analysis.txt` - Shows complete OpenAI object serialization
2. **API Logs**: `/home/kuitang/git/vibegrapher/backend/openai_api_samples.log` - 1,405 stream events with complete sequences
3. **Usage Code**: `/home/kuitang/git/vibegrapher/backend/app/agents/all_agents.py` - How the SDK is used
4. **SDK Source**: `.venv/lib/python3.11/site-packages/agents/` - Internal structures and types

### Stream Event Types Found:
- `agent_updated_stream_event` - Agent initialization
- `run_item_stream_event` - Tool calls, outputs, messages
- `raw_response_event` - Token-level streaming (filtered as noise)

### Data Structures:
- Complete Agent objects with name, model, instructions, tools
- Tool calls with arguments, call_ids, function names
- Tool outputs with evaluation results (approved/reasoning/commit_message)
- Response objects with usage tokens, metadata

## Mock Architecture Plan

### 1. Core Mock Classes Structure

```python
# backend/app/mocks/openai_agents_sdk.py

from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional
from agents.stream_events import StreamEvent, AgentUpdatedStreamEvent, RunItemStreamEvent
from agents.result import RunResultStreaming
from agents.items import ToolCallItem, ToolCallOutputItem, MessageOutputItem
from agents.agent import Agent

@dataclass
class MockResponse:
    """Mock OpenAI Response object with all required fields"""
    id: str
    created_at: float
    model: str
    object: str = "response"
    status: str = "completed"
    instructions: str = ""
    output: List[Any] = None
    usage: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = None
    # ... all other fields from logs

@dataclass
class MockAgent:
    """Mock Agent matching production structure"""
    name: str
    model: str
    instructions: str
    tools: List[str]
    _type: str = "Agent"

class MockToolCallItem:
    """Mock ToolCallItem with raw_item structure"""
    def __init__(self, call_id: str, name: str, arguments: str, status: str = "completed"):
        self.raw_item = {
            "arguments": arguments,
            "call_id": call_id,
            "name": name,
            "type": "function_call",
            "id": f"fc_{call_id}",
            "status": status
        }
        self.agent = None  # Will be set by mock
        self.type = "tool_call_item"

class MockToolCallOutputItem:
    """Mock ToolCallOutputItem with evaluation results"""
    def __init__(self, call_id: str, output_data: Dict[str, Any]):
        self.raw_item = {
            "call_id": call_id,
            "output": str(output_data),  # Serialized evaluation
            "type": "function_call_output"
        }
        self.output = output_data  # Structured evaluation result
        self.agent = None
        self.type = "tool_call_output_item"
```

### 2. Mock Event Sequence Generator

```python
class MockEventSequenceGenerator:
    """Generates realistic event sequences based on logged patterns"""
    
    def __init__(self):
        self.sequences = self._load_recorded_sequences()
    
    def _load_recorded_sequences(self) -> List[Dict[str, Any]]:
        """Load pre-recorded event sequences from logs"""
        # Parse openai_api_samples.log to extract complete sequences
        # Each sequence represents one complete vibecode session
        return [
            {
                "trigger": "patch_request",
                "events": [
                    {"type": "agent_updated", "agent": "Vibecoder"},
                    {"type": "tool_called", "name": "submit_patch", "args": "..."},
                    {"type": "tool_output", "approved": False, "reasoning": "..."},
                    {"type": "tool_called", "name": "submit_patch", "args": "..."},
                    {"type": "tool_output", "approved": True, "reasoning": "..."}
                ],
                "final_output": "EvaluationResult(approved=True, ...)"
            },
            # More sequences for different scenarios
        ]
    
    def get_sequence_for_input(self, user_input: str) -> Dict[str, Any]:
        """Select appropriate sequence based on input pattern"""
        # Simple pattern matching for now
        if "comment" in user_input.lower():
            return self.sequences[0]  # Comment addition sequence
        elif "docstring" in user_input.lower():
            return self.sequences[1]  # Docstring sequence
        else:
            return self.sequences[0]  # Default sequence
```

### 3. Mock Runner Implementation

```python
class MockRunner:
    """Mock implementation of agents.Runner"""
    
    def __init__(self):
        self.event_generator = MockEventSequenceGenerator()
        self._sequence_counter = 0
    
    @classmethod
    def run_streamed(
        cls,
        starting_agent: Agent,
        input_prompt: str,
        session: Any = None,
        **kwargs
    ) -> 'MockRunResultStreaming':
        """Mock implementation of Runner.run_streamed()"""
        runner = cls()
        return runner._create_streaming_result(starting_agent, input_prompt, session)
    
    def _create_streaming_result(
        self, 
        agent: Agent, 
        input_prompt: str, 
        session: Any
    ) -> 'MockRunResultStreaming':
        """Create a mock streaming result that yields realistic events"""
        
        sequence = self.event_generator.get_sequence_for_input(input_prompt)
        
        return MockRunResultStreaming(
            agent=agent,
            input_prompt=input_prompt,
            event_sequence=sequence,
            session=session
        )

class MockRunResultStreaming:
    """Mock implementation of RunResultStreaming"""
    
    def __init__(self, agent: Agent, input_prompt: str, event_sequence: Dict, session: Any):
        self.current_agent = agent
        self.input_prompt = input_prompt
        self.event_sequence = event_sequence
        self.session = session
        self.is_complete = False
        self.final_output = None
        
    async def stream_events(self) -> AsyncIterator[StreamEvent]:
        """Stream mock events in realistic sequence with timing"""
        
        import asyncio
        sequence_num = 0
        
        # 1. Agent Updated Event
        yield AgentUpdatedStreamEvent(
            new_agent=self._create_mock_agent(),
            type="agent_updated_stream_event"
        )
        
        # 2. Stream tool call events based on recorded patterns
        for event_spec in self.event_sequence["events"]:
            sequence_num += 1
            
            if event_spec["type"] == "tool_called":
                # Create tool call item
                tool_call = MockToolCallItem(
                    call_id=f"call_{sequence_num}",
                    name=event_spec["name"],
                    arguments=event_spec.get("args", "{}"),
                )
                tool_call.agent = self._create_mock_agent()
                
                yield RunItemStreamEvent(
                    name="tool_called",
                    item=tool_call,
                    type="run_item_stream_event"
                )
                
                # Small delay to simulate network timing
                await asyncio.sleep(0.1)
                
            elif event_spec["type"] == "tool_output":
                # Create tool output item
                output_data = {
                    "approved": event_spec.get("approved", False),
                    "reasoning": event_spec.get("reasoning", "Mock reasoning"),
                    "commit_message": event_spec.get("commit_message", "Mock commit")
                }
                
                tool_output = MockToolCallOutputItem(
                    call_id=f"call_{sequence_num-1}",  # Match previous call
                    output_data=output_data
                )
                tool_output.agent = self._create_mock_agent()
                
                yield RunItemStreamEvent(
                    name="tool_output",
                    item=tool_output,
                    type="run_item_stream_event"
                )
                
                # Set final output if approved
                if output_data["approved"]:
                    from backend.app.agents.all_agents import EvaluationResult
                    self.final_output = EvaluationResult(**output_data)
                
                await asyncio.sleep(0.1)
        
        # Mark complete
        self.is_complete = True
    
    def _create_mock_agent(self) -> MockAgent:
        """Create mock agent matching logged structure"""
        return MockAgent(
            name="Vibecoder",
            model="gpt-4o-mini",
            instructions="You are VibeCoder, an expert Python developer...",
            tools=["submit_patch"]
        )
```

### 4. Mock Integration Points

```python
# backend/app/mocks/__init__.py

import os
from typing import Optional

# Global flag to enable/disable mocking
USE_OPENAI_MOCKS = os.getenv("USE_OPENAI_MOCKS", "false").lower() == "true"

def get_runner_class():
    """Get the appropriate Runner class based on mock setting"""
    if USE_OPENAI_MOCKS:
        from .openai_agents_sdk import MockRunner
        return MockRunner
    else:
        from agents import Runner
        return Runner

# Monkey patch for seamless integration
if USE_OPENAI_MOCKS:
    import agents
    from .openai_agents_sdk import MockRunner
    agents.Runner = MockRunner
```

### 5. Event Data Factories

```python
class MockEventFactory:
    """Factory for creating realistic mock events with proper data structures"""
    
    @staticmethod
    def create_agent_updated_event() -> Dict[str, Any]:
        """Create agent updated event matching logged structure"""
        return {
            "new_agent": {
                "name": "Vibecoder",
                "model": "gpt-4o-mini",
                "instructions": "You are VibeCoder, an expert Python developer who helps modify code.\n\nYou have TWO response modes:\n\n1. PATCH MODE: When the user asks to modify, add, or change code, use the submit_patch tool.\n   - Ge...",
                "tools": ["submit_patch"],
                "_type": "Agent"
            },
            "type": "agent_updated_stream_event"
        }
    
    @staticmethod
    def create_tool_call_event(call_id: str, patch_content: str, description: str) -> Dict[str, Any]:
        """Create tool call event with realistic patch data"""
        return {
            "name": "tool_called",
            "item": {
                "agent": MockEventFactory._get_agent_dict(),
                "raw_item": {
                    "arguments": f'{{"patch":"{patch_content}","description":"{description}"}}',
                    "call_id": call_id,
                    "name": "submit_patch",
                    "type": "function_call",
                    "id": f"fc_{call_id}",
                    "status": "completed"
                },
                "type": "tool_call_item"
            },
            "type": "run_item_stream_event"
        }
    
    @staticmethod
    def create_tool_output_event(call_id: str, approved: bool, reasoning: str, commit_message: str) -> Dict[str, Any]:
        """Create tool output event with evaluation results"""
        output_str = f"approved={approved} reasoning='{reasoning}' commit_message='{commit_message}'"
        
        return {
            "name": "tool_output",
            "item": {
                "agent": MockEventFactory._get_agent_dict(),
                "raw_item": {
                    "call_id": call_id,
                    "output": output_str,
                    "type": "function_call_output"
                },
                "output": {
                    "approved": approved,
                    "reasoning": reasoning,
                    "commit_message": commit_message
                },
                "type": "tool_call_output_item"
            },
            "type": "run_item_stream_event"
        }
    
    @staticmethod
    def _get_agent_dict() -> Dict[str, Any]:
        """Get standard agent dictionary"""
        return {
            "name": "Vibecoder",
            "model": "gpt-4o-mini",
            "instructions": "You are VibeCoder, an expert Python developer who helps modify code.\n\nYou have TWO response modes:\n\n1. PATCH MODE: When the user asks to modify, add, or change code, use the submit_patch tool.\n   - Ge...",
            "tools": ["submit_patch"],
            "_type": "Agent"
        }
```

### 6. Scenario-Based Mock Sequences

```python
class MockScenarios:
    """Pre-defined scenarios based on logged interactions"""
    
    COMMENT_ADDITION_APPROVED = {
        "name": "comment_addition_approved",
        "description": "User requests adding a comment, approved on first try",
        "events": [
            {
                "type": "agent_updated",
                "delay": 0.0
            },
            {
                "type": "tool_called",
                "name": "submit_patch",
                "patch": "@@ -1,6 +1,7 @@\n # Welcome to Vibegrapher\n # Project: Test\n+\n # Added explanatory comment\n\ndef main():",
                "description": "Added explanatory comment",
                "delay": 2.0
            },
            {
                "type": "tool_output",
                "approved": True,
                "reasoning": "Good addition of clarifying comment that improves code readability",
                "commit_message": "Add explanatory comment to improve code clarity",
                "delay": 1.0
            }
        ]
    }
    
    COMMENT_ADDITION_REJECTED_THEN_APPROVED = {
        "name": "comment_addition_rejected_then_approved",
        "description": "User requests adding comment, rejected first, approved second",
        "events": [
            {
                "type": "agent_updated",
                "delay": 0.0
            },
            {
                "type": "tool_called",
                "name": "submit_patch",
                "patch": "@@ -1,6 +1,7 @@\n # Welcome to Vibegrapher\n # Project: Test\n+\n\ndef main():",
                "description": "Added a blank line",
                "delay": 2.0
            },
            {
                "type": "tool_output",
                "approved": False,
                "reasoning": "The patch adds a blank line but doesn't add meaningful commentary as requested",
                "commit_message": "Error: Add actual comment content, not just whitespace",
                "delay": 1.0
            },
            {
                "type": "tool_called",
                "name": "submit_patch",
                "patch": "@@ -1,6 +1,8 @@\n # Welcome to Vibegrapher\n # Project: Test\n+\n+# This function initializes the application\ndef main():",
                "description": "Added explanatory comment about main function",
                "delay": 2.0
            },
            {
                "type": "tool_output",
                "approved": True,
                "reasoning": "Good addition of meaningful comment that explains the function's purpose",
                "commit_message": "Add explanatory comment for main function",
                "delay": 1.0
            }
        ]
    }
    
    TEXT_RESPONSE_MODE = {
        "name": "text_response_mode",
        "description": "User asks a question, gets text response",
        "events": [
            {
                "type": "agent_updated",
                "delay": 0.0
            },
            {
                "type": "message_output",
                "content": "This code defines a simple Python application with a main function that prints 'Ready for vibecoding!' when executed.",
                "delay": 1.5
            }
        ]
    }

    @classmethod
    def get_scenario_for_input(cls, user_input: str) -> Dict[str, Any]:
        """Select scenario based on user input patterns"""
        input_lower = user_input.lower()
        
        if "what does" in input_lower or "explain" in input_lower:
            return cls.TEXT_RESPONSE_MODE
        elif "comment" in input_lower:
            # 70% chance of approval, 30% chance of rejection then approval
            import random
            if random.random() < 0.7:
                return cls.COMMENT_ADDITION_APPROVED
            else:
                return cls.COMMENT_ADDITION_REJECTED_THEN_APPROVED
        else:
            # Default to simple approved scenario
            return cls.COMMENT_ADDITION_APPROVED
```

### 7. Database Integration for Mock Sequences

```python
class MockSequenceRecorder:
    """Records and replays exact sequences from database"""
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    def load_recorded_sequence(self, session_id: str) -> List[Dict[str, Any]]:
        """Load exact sequence from conversation_messages table"""
        
        messages = self.db.query(
            "SELECT * FROM conversation_messages WHERE session_id = ? ORDER BY stream_sequence",
            [session_id]
        )
        
        events = []
        for msg in messages:
            if msg['message_type'] == 'stream_event':
                event_data = json.loads(msg['event_data'])
                events.append({
                    'type': msg['stream_event_type'],
                    'data': event_data,
                    'tool_calls': json.loads(msg['tool_calls']) if msg['tool_calls'] else None,
                    'tool_outputs': json.loads(msg['tool_outputs']) if msg['tool_outputs'] else None,
                    'sequence': msg['stream_sequence']
                })
        
        return events
    
    def replay_sequence_as_stream(self, events: List[Dict[str, Any]]) -> AsyncIterator[StreamEvent]:
        """Convert recorded events back to stream events"""
        
        for event in events:
            if event['type'] == 'agent_updated_stream_event':
                yield AgentUpdatedStreamEvent(
                    new_agent=self._reconstruct_agent(event['data']['new_agent']),
                    type="agent_updated_stream_event"
                )
            
            elif event['type'] == 'run_item_stream_event':
                item_data = event['data']['item']
                
                if event['data']['name'] == 'tool_called':
                    tool_item = self._reconstruct_tool_call_item(item_data)
                    yield RunItemStreamEvent(
                        name="tool_called",
                        item=tool_item,
                        type="run_item_stream_event"
                    )
                
                elif event['data']['name'] == 'tool_output':
                    output_item = self._reconstruct_tool_output_item(item_data)
                    yield RunItemStreamEvent(
                        name="tool_output",
                        item=output_item,
                        type="run_item_stream_event"
                    )
            
            # Add small delay to simulate realistic timing
            await asyncio.sleep(0.1)
```

### 8. Configuration and Environment Setup

```python
# backend/app/config/mock_config.py

from dataclasses import dataclass
from typing import Dict, Any, Optional

@dataclass
class MockConfig:
    """Configuration for mock behavior"""
    
    # Enable/disable mocking
    enabled: bool = False
    
    # Mock behavior settings
    simulate_delays: bool = True
    base_delay_ms: int = 100
    random_delay_range_ms: int = 50
    
    # Scenario selection
    default_scenario: str = "comment_addition_approved"
    scenario_weights: Dict[str, float] = None
    
    # Failure simulation
    simulate_failures: bool = False
    failure_rate: float = 0.05
    
    # Logging
    log_mock_events: bool = True
    log_file: str = "mock_events.log"

def get_mock_config() -> MockConfig:
    """Get mock configuration from environment"""
    import os
    
    # IMPORTANT: Use JSON
    return MockConfig(... parse this from environment json ...)
        enabled=implied if the variable is set
        enabled=os.getenv("USE_OPENAI_MOCKS", "false").lower() == "true",
        # Keep these defaults; ignore old syntax
        <!-- simulate_delays=os.getenv("MOCK_SIMULATE_DELAYS", "true").lower() == "true", -->
        <!-- base_delay_ms=int(os.getenv("MOCK_BASE_DELAY_MS", "100")), -->
        <!-- random_delay_range_ms=int(os.getenv("MOCK_DELAY_RANGE_MS", "50")), -->
        <!-- default_scenario=os.getenv("MOCK_DEFAULT_SCENARIO", "comment_addition_approved"), -->
        <!-- simulate_failures=os.getenv("MOCK_SIMULATE_FAILURES", "false").lower() == "true", -->
        <!-- failure_rate=float(os.getenv("MOCK_FAILURE_RATE", "0.05")), -->
        <!-- log_mock_events=os.getenv("MOCK_LOG_EVENTS", "true").lower() == "true", -->
        <!-- log_file=os.getenv("MOCK_LOG_FILE", "mock_events.log") -->
    )
```

### 9. Testing Integration

```python
# backend/tests/test_mocks.py

import pytest
from app.mocks.openai_agents_sdk import MockRunner
from app.agents.all_agents import vibecode_service

@pytest.mark.asyncio
async def test_mock_runner_basic_flow():
    """Test basic mock runner functionality"""
    
    # Create mock agent (simplified for testing)
    class MockAgent:
        name = "Vibecoder"
        model = "gpt-5-nano"
        instructions = "Test agent"
        tools = []
    
    agent = MockAgent()
    result = MockRunner.run_streamed(agent, "Add a comment")
    
    events = []
    async for event in result.stream_events():
        events.append(event)
    
    # Verify we got expected sequence
    assert len(events) >= 2  # At least agent_updated and tool_called
    assert events[0].type == "agent_updated_stream_event"
    assert any(e.type == "run_item_stream_event" for e in events)

@pytest.mark.asyncio
async def test_mock_integration_with_vibecode_service():
    """Test mock integration with actual vibecode service"""
    
    import os
    os.environ["USE_OPENAI_MOCKS"] = "true"
    
    # This should use mocked Runner
    result = await vibecode_service.vibecode(
        project_id="test-project",
        prompt="Add a comment",
        current_code="def main():\n    pass",
        project_slug="test-project",
        session_id="test-session"
    )
    
    assert result is not None
    assert hasattr(result, 'messages')
    assert len(result.messages) > 0

def test_scenario_selection():
    """Test that scenarios are selected correctly"""
    from app.mocks.openai_agents_sdk import MockScenarios
    
    # Test comment scenario
    scenario = MockScenarios.get_scenario_for_input("Add a comment to explain this function")
    assert "comment" in scenario["name"]
    
    # Test question scenario
    scenario = MockScenarios.get_scenario_for_input("What does this code do?")
    assert scenario["name"] == "text_response_mode"
```

### 10. Usage Examples and Integration Points

```python
# Example 1: Enable mocks via environment variable
# export USE_OPENAI_MOCKS=true
# uvicorn app.main:app --reload

# Example 2: Enable mocks programmatically
import os
os.environ["USE_OPENAI_MOCKS"] = "true"

from app.agents.all_agents import vibecode_service

# This will now use mocked OpenAI calls
result = await vibecode_service.vibecode(
    project_id="test-project", 
    prompt="Add docstring",
    current_code="def hello(): pass",
    project_slug="test"
)

# Example 3: Force specific scenario for testing
from app.mocks.openai_agents_sdk import MockScenarios, MockRunner

MockRunner.force_scenario = MockScenarios.COMMENT_ADDITION_REJECTED_THEN_APPROVED

# This will now follow the rejection->approval pattern
result = await vibecode_service.vibecode(...)
```

## Implementation Steps

### Phase 1: Core Mock Infrastructure (Week 1)
1. Create `backend/app/mocks/` directory structure
2. Implement `MockAgent`, `MockToolCallItem`, `MockToolCallOutputItem` classes
3. Create `MockEventFactory` with realistic data generation
4. Implement basic `MockRunner` with simple event streaming

### Phase 2: Scenario System (Week 2)
1. Implement `MockScenarios` with pre-defined patterns
2. Create `MockEventSequenceGenerator` with input pattern matching
3. Add scenario selection logic and weighting system
4. Implement timing delays and realistic event pacing

### Phase 3: Database Integration (Week 3)
1. Implement `MockSequenceRecorder` for replaying actual sequences
2. Create database query methods for loading recorded events
3. Add sequence conversion methods (DB → StreamEvents)
4. Implement exact replay functionality for deterministic testing

### Phase 4: Advanced Features (Week 4)
1. Add failure simulation and error scenarios
2. Implement configuration system with environment variables
3. Create comprehensive test suite
4. Add monitoring and logging for mock events

### Phase 5: Integration and Testing (Week 5)
1. Integrate mocks with existing vibecode service
2. Create switch mechanism for enabling/disabling mocks
3. Comprehensive end-to-end testing
4. Performance optimization and memory management

## Testing Strategy

### Unit Tests:
- Mock class instantiation and data structure validation
- Event factory output verification
- Scenario selection logic
- Sequence timing and ordering

### Integration Tests:
- Mock integration with vibecode_service
- Database integration and sequence replay
- Socket.io emission with mock events
- Frontend compatibility with mock data

### End-to-End Tests:
- Full vibecode workflow using mocks
- Multi-iteration scenarios (rejection → approval)
- Session persistence and conversation history
- Error handling and edge cases

## Configuration Management

### Environment Variables:
Define an OPENAI_MOCK_CONFIGS={JSON...}

IMPORTANT: Definition here controls. Other usages are from earlier draft which is inconsistent. Env var is a json.

json includes these in lowercase, with defaults (set in the reader)
USE_OPENAI_MOCKS=true                    # Enable/disable mocking
MOCK_SIMULATE_DELAYS=true                # Add realistic delays
MOCK_BASE_DELAY_MS=100                   # Base delay between events
MOCK_DELAY_RANGE_MS=50                   # Random delay variance
MOCK_DEFAULT_SCENARIO=comment_approved   # Default scenario
MOCK_SIMULATE_FAILURES=false             # Enable failure simulation
MOCK_FAILURE_RATE=0.05                   # 5% failure rate
MOCK_LOG_EVENTS=true                     # Log mock events

### Runtime Configuration:
- Force specific scenarios for testing
- Override timing and delays
- Enable/disable logging
- Switch between recorded and synthetic sequences

## Data Fidelity Requirements

The mock system must maintain 100% data structure fidelity with production:

1. **Agent Objects**: Exact field matching (name, model, instructions, tools, _type)
2. **Tool Calls**: Identical JSON structure with arguments, call_ids, status
3. **Tool Outputs**: Perfect EvaluationResult matching (approved, reasoning, commit_message)
4. **Event Metadata**: Complete event_data structure preservation
5. **Database Schema**: All fields populated identically to production
6. **Socket.io Events**: Exact message structure and field names

## Success Criteria

1. **Functional**: All existing tests pass with mocks enabled
2. **Performance**: Mock events stream faster than production (no network latency)
3. **Deterministic**: Same input produces same output sequence when desired
4. **Realistic**: Timing and patterns match production behavior
5. **Comprehensive**: Support all major user interaction patterns
6. **Maintainable**: Easy to add new scenarios and modify behavior
7. **Debuggable**: Clear logging and error messages

## Future Enhancements

1. **Machine Learning Integration**: Use logged patterns to generate more realistic sequences
2. **Dynamic Scenarios**: Generate new scenarios based on code analysis
3. **Performance Testing**: Support high-throughput mock scenarios
4. **Analytics**: Track mock usage patterns and scenario effectiveness
5. **Visual Debugging**: UI for inspecting mock sequences and timing
6. **Cloud Integration**: Mock sequences stored in cloud for team sharing

## Risks and Mitigations

### Risk: Mock Drift from Production
**Mitigation**: Regular validation against production logs, automated comparison tests

### Risk: Incomplete Scenario Coverage
**Mitigation**: Comprehensive scenario library, easy scenario addition process

### Risk: Performance Impact
**Mitigation**: Lazy loading, memory pooling, configurable delay settings

### Risk: Test Reliability
**Mitigation**: Deterministic modes, seed-based randomization, comprehensive logging

This plan provides a complete roadmap for implementing a production-ready mock system that maintains perfect fidelity with the OpenAI Agents SDK while enabling fast, reliable testing and development.

# IMPORTANT: Test plan
 - run an integration test setting the mock environment variable. Set once to empty dict or true to see defaults; see it work.
 - set to different settings sometimes to test variation in settings.
 - compare output to validated test evidence (see top). WRite this to validated test evidence.
 - test that we can serialize mock objects to Postgres and to all other models, i.e. the frontend, json, etc.
 - IMPORTANT: purpose of mock is to be data compatible.
