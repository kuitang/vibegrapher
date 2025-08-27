"""
All OpenAI Agents for Vibegrapher
VibeCoder and Evaluator agents with patch submission workflow

# IMPORTANT: KEEP ALL OPENAI LOGGING
This file contains comprehensive OpenAI API interaction logging to openai_api_samples.log
which captures complete request/response cycles for mock generation and debugging.
DO NOT remove the api_logger or safe_serialize_openai_object functionality.
"""

import ast
import json
import logging

# Import Runner with mock support - done after other imports to avoid circular dependency
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from agents import Agent, SQLiteSession, function_tool
from agents.items import (
    HandoffOutputItem,
    MessageOutputItem,
    ToolCallItem,
    ToolCallOutputItem,
)
from agents.stream_events import (
    AgentUpdatedStreamEvent,
    RawResponsesStreamEvent,
    RunItemStreamEvent,
    StreamEvent,
)
from pydantic import BaseModel

from ..utils.diff_parser import diff_parser

if os.getenv("USE_OPENAI_MOCKS", "false").lower() == "true":
    from ..mocks.openai_agents_sdk import MockRunner as Runner
else:
    from agents import Runner


logger = logging.getLogger(__name__)

# OpenAI API logging setup
api_logger = logging.getLogger("openai_api_samples")
api_logger.setLevel(logging.INFO)
api_handler = logging.FileHandler("openai_api_samples.log")
api_handler.setFormatter(logging.Formatter("%(asctime)s - %(message)s"))
api_logger.addHandler(api_handler)


def safe_serialize_openai_object(obj) -> str:
    """Convert OpenAI objects to JSON string using native JSON serialization"""

    def json_serializer(o):
        """Custom JSON serializer for non-serializable objects"""
        if hasattr(o, "model_dump"):
            return o.model_dump(mode="json")
        elif hasattr(o, "dict"):
            return o.dict()
        return str(o)

    try:
        return json.dumps(obj, default=json_serializer, ensure_ascii=False)
    except Exception as e:
        logger.exception(f"Failed to serialize OpenAI object of type {type(obj)}")
        return json.dumps({"_error": str(e), "_type": str(type(obj))})


# CRITICAL!!!: DO NOT CHANGE!!!
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-mini",  # CRITICAL: DO NOT CHANGE!
    "SMALL_MODEL": "gpt-5-nano",  # CRITICAL: DO NOT CHANGE!
}


# Define EvaluationResult Pydantic model - INCLUDES COMMIT MESSAGE
class EvaluationResult(BaseModel):
    approved: bool
    reasoning: str
    commit_message: str  # Suggested commit message if approved


# Validation function - apply patch then check syntax in ONE STEP
def validate_patch(original: str, patch: str) -> dict:
    """
    Apply patch and check syntax in ONE STEP
    Returns validation result with VERBATIM error if invalid
    """
    # 1. Apply patch to temp copy
    try:
        patched_code = diff_parser.apply_patch(original, patch)
    except ValueError as e:
        return {"valid": False, "error": f"Failed to apply patch: {e}"}

    # 2. Run Python syntax check on result
    try:
        ast.parse(patched_code)
        return {"valid": True, "patched_code": patched_code}
    except SyntaxError as e:
        # 3. Return VERBATIM error if invalid
        return {"valid": False, "error": f"SyntaxError: {e.msg} at line {e.lineno}"}


# Evaluator agent
evaluator_agent = Agent(
    name="Evaluator",
    model=MODEL_CONFIGS["SMALL_MODEL"],
    instructions="""You are an expert code reviewer who evaluates patches for quality and correctness.

Review the submitted patch and:
1. Assess if the changes are appropriate and safe
2. Check if the changes achieve the stated goal
3. Suggest improvements if needed
4. Provide a clear, concise commit message

Be lenient and approve reasonable changes. Focus on:
- Does the patch apply cleanly?
- Is the syntax valid?
- Does it achieve the user's goal?

Always provide constructive feedback and a suggested commit message.

Your response must be in the format:
approved: true/false
reasoning: your evaluation
commit_message: suggested commit message""",
    output_type=EvaluationResult,  # Now includes commit_message field
)


class VibecodeResult(BaseModel):
    content: str | None = None  # if we fail
    diff_id: str | None = None  # if we succeed
    openai_response: Any  # Full OpenAI response object
    messages: list[dict] = []  # All stream event messages


class VibecodeService:
    """Service for handling vibecode requests with agent interaction"""

    def __init__(self):
        self.last_iteration_count = 0

    async def vibecode(
        self,
        project_id: str,
        prompt: str,
        current_code: str,
        project_slug: str,
        node_id: str | None = None,
        session_id: str | None = None,
        socketio_manager=None,
    ) -> VibecodeResult:
        """Main vibecode workflow with streaming agent interaction"""

        # Create session key with correct format (uses project.slug for consistency)
        session_key = (
            f"project_{project_slug}_node_{node_id}"
            if node_id
            else f"project_{project_slug}"
        )

        # Use project.slug for filesystem paths to ensure valid filenames
        db_path = f"media/projects/{project_slug}_conversations.db"

        # Ensure media directory exists
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

        # MUST use file persistence, not in-memory
        session = SQLiteSession(session_key, db_path)
        evaluator_session_key = session_key + "_evaluator"
        evaluator_session = SQLiteSession(evaluator_session_key, db_path)

        # Define submit_patch as a nested function to capture current_code and evaluator_session
        @function_tool
        async def submit_patch(patch: str, description: str) -> EvaluationResult:
            """Submit a patch for evaluation.

            Args:
                patch: The unified diff patch to apply
                description: Description of the changes made
            """
            # 1. Use current_code from closure
            # 2. Run validate_patch() - single step validation
            validation = validate_patch(current_code, patch)

            # 3. If invalid, return verbatim error to user
            if not validation["valid"]:
                return EvaluationResult(
                    approved=False,
                    reasoning=f"Patch validation failed: {validation['error']}",
                    commit_message="",
                )

            # 4. If valid, call the evaluator using evaluator_session from closure
            eval_prompt = f"""Please review this patch:

{patch}

Description: {description}

Original code:
```python
{current_code}
```

Patched code:
```python
{validation['patched_code']}
```
"""

            # Run evaluator agent
            result = await Runner.run(
                evaluator_agent, eval_prompt, session=evaluator_session
            )

            # 5. Return with the evaluator's decision
            return result.final_output

        # Create VibeCoder agent with the submit_patch tool
        vibecoder_agent = Agent(
            name="Vibecoder",
            model=MODEL_CONFIGS["THINKING_MODEL"],
            instructions="""You are VibeCoder, an expert Python developer who helps modify code.

You have TWO response modes:

1. PATCH MODE: When the user asks to modify, add, or change code, use the submit_patch tool.
   - Generate a unified diff patch in proper format
   - Include a clear description of changes
   - The patch should be in unified diff format like:
     ```
     @@ -line,count +line,count @@
     -removed line
     +added line
      context line
     ```

2. TEXT MODE: When the user asks questions about code or needs explanations, respond with text.
   - Explain code functionality
   - Answer questions
   - Provide guidance

Current code is provided in the user message.

CRITICAL REQUIREMENT:
You must EITHER use the submit_patch tool OR return text to the user.
DO NOT return code in your text response. If you need to provide code changes, you MUST use the submit_patch tool.

IMPORTANT:
- When generating patches, use proper unified diff format
- Include context lines for clarity
- Make minimal, focused changes
- Ensure the patched code is syntactically valid""",
            tools=[submit_patch],
        )

        try:
            collected_messages = []

            for iteration in range(3):  # MAX 3 iterations
                self.last_iteration_count = iteration + 1

                # Log iteration for integration tests
                logger.info(f"Running VibeCoder iteration {iteration + 1}")

                # Build user prompt with current code
                user_prompt = f"Current code:\n```python\n{current_code}\n```\n\nUser request: {prompt}"

                # Log OpenAI API interaction
                api_logger.info(
                    f"=== OPENAI API CALL START (Iteration {iteration + 1}) ==="
                )
                api_logger.info(f"Agent: {vibecoder_agent.name}")
                api_logger.info(f"Model: {vibecoder_agent.model}")
                api_logger.info(f"Prompt: {user_prompt}")
                api_logger.info(f"Session: {session_key}")

                # Run VibeCoder with streaming (run_streamed returns RunResultStreaming, not a coroutine)
                vibecoder_response = Runner.run_streamed(
                    vibecoder_agent, user_prompt, session=session
                )

                # Process stream events
                sequence_counter = 0
                last_sequence = -1
                evaluation = None

                async for event in vibecoder_response.stream_events():
                    # Log every stream event for mock generation
                    api_logger.info(f"Stream Event: {event.type}")
                    api_logger.info(
                        f"Event Data: {safe_serialize_openai_object(event)}"
                    )

                    # Skip RawResponsesStreamEvent noise - don't create messages for these
                    if isinstance(event, RawResponsesStreamEvent):
                        api_logger.info("Skipping RawResponsesStreamEvent (noise)")
                        continue

                    sequence_counter += 1

                    # Check for sequence gaps
                    if last_sequence >= 0 and sequence_counter != last_sequence + 1:
                        logger.error(
                            f"❌ EVENT SEQUENCE GAP: Expected {last_sequence + 1}, got {sequence_counter}"
                        )
                    last_sequence = sequence_counter

                    # Create message from meaningful event only
                    message = await self._create_message_from_event(
                        event, session_id, sequence_counter, iteration
                    )

                    collected_messages.append(message)

                    # Save to database immediately
                    await self._save_conversation_message_async(message)

                    # Emit via Socket.io directly (no wrapper)
                    if socketio_manager and session_id and project_id:
                        logger.info(
                            f"🔥 DIRECT Socket.io emission: {message['id']} to project {project_id}"
                        )

                        # Create message data (bypass wrapper)
                        data = {
                            "message_id": message["id"],
                            "session_id": session_id,
                            "role": message["role"],
                            "message_type": message.get("message_type", "stream_event"),
                            "content": message.get("content"),
                            "stream_event_type": message.get("stream_event_type"),
                            "stream_sequence": message.get("stream_sequence"),
                            "event_data": message.get("event_data"),
                            "tool_calls": message.get("tool_calls"),
                            "tool_outputs": message.get("tool_outputs"),
                            "handoffs": message.get("handoffs"),
                            "agent": message.get("agent_type", "vibecoder"),
                            "iteration": iteration,
                            "created_at": datetime.now().isoformat(),
                        }

                        try:
                            # Direct emission without wrapper overhead
                            await socketio_manager.sio.emit(
                                "conversation_message",
                                data,
                                room=f"project_{project_id}",
                            )
                            logger.info(
                                f"✅ Emitted seq:{message.get('stream_sequence')} to project_{project_id}"
                            )
                        except Exception as e:
                            logger.error(f"❌ Socket.io emission error: {e}")

                        # Skip the original wrapper call
                        pass

                    # Check if we got an evaluation result
                    if (
                        isinstance(event, RunItemStreamEvent)
                        and hasattr(event.item, "output")
                        and hasattr(event.item.output, "approved")
                    ):
                        # Check if it looks like an EvaluationResult (has required fields)
                        output = event.item.output
                        if hasattr(output, "reasoning") and hasattr(
                            output, "commit_message"
                        ):
                            evaluation = output

                # Log final API response
                api_logger.info(
                    f"=== OPENAI API CALL END (Iteration {iteration + 1}) ==="
                )
                api_logger.info(
                    f"Final Response: {safe_serialize_openai_object(vibecoder_response)}"
                )
                api_logger.info(f"Evaluation Found: {evaluation is not None}")
                if evaluation:
                    api_logger.info(
                        f"Evaluation Result: {safe_serialize_openai_object(evaluation)}"
                    )

                if evaluation:
                    # Evaluator was called via submit_patch
                    if evaluation.approved:
                        # Create Diff record with status='evaluator_approved'
                        return VibecodeResult(
                            diff_id="generated-diff-id",  # Will be replaced by actual diff creation
                            openai_response=vibecoder_response,
                            messages=collected_messages,
                        )
                    else:
                        # If rejected, loop with feedback
                        prompt = f"The evaluator rejected your patch. Feedback: {evaluation.reasoning}\n\nPlease try again."
                        continue
                else:
                    # Text response mode - no patch submitted
                    return VibecodeResult(
                        content=(
                            vibecoder_response.final_output
                            if hasattr(vibecoder_response, "final_output")
                            else ""  # Return empty string instead of str() representation
                        ),
                        openai_response=vibecoder_response,
                        messages=collected_messages,
                    )

            # Max iterations reached
            return VibecodeResult(
                content="Maximum iteration limit reached without approval",
                openai_response=None,
                messages=collected_messages,
            )

        except Exception as e:
            logger.error(f"Error in vibecode: {e}", exc_info=True)
            raise

    async def _create_message_from_event(
        self, event: StreamEvent, session_id: str, sequence: int, iteration: int
    ) -> dict:
        """Create a ConversationMessage dict from a stream event"""

        timestamp = datetime.now().isoformat()
        message = {
            "id": f"{session_id}_event_{sequence}",
            "session_id": session_id,
            "role": "assistant",
            "message_type": "stream_event",
            "stream_event_type": event.type,
            "stream_sequence": sequence,
            "iteration": iteration,
            "created_at": timestamp,
            "updated_at": timestamp,
            "event_data": {},  # Will populate below
            "content": "",
            "tool_calls": None,
            "tool_outputs": None,
            "handoffs": None,
            "agent_type": None,
            "token_usage": None,
        }

        # Store complete event data as JSON (preserve all OpenAI data)
        message["event_data"] = safe_serialize_openai_object(event)

        # Process meaningful events only
        if isinstance(event, RunItemStreamEvent):
            item = event.item

            # Store complete item data based on type
            if isinstance(item, ToolCallItem):
                message["tool_calls"] = [safe_serialize_openai_object(item.raw_item)]

            elif isinstance(item, ToolCallOutputItem):
                message["tool_outputs"] = [safe_serialize_openai_object(item.raw_item)]

            elif isinstance(item, HandoffOutputItem):
                message["handoffs"] = [
                    {
                        "source_agent": item.source_agent.name,
                        "target_agent": item.target_agent.name,
                        "full_handoff": safe_serialize_openai_object(item),
                    }
                ]

            elif isinstance(item, MessageOutputItem):
                try:
                    # Extract text content from the MessageOutputItem
                    text = ""
                    if hasattr(item.raw_item, "content"):
                        for content_item in item.raw_item.content:
                            if hasattr(content_item, "text"):
                                text += content_item.text
                    message["content"] = text
                except Exception as e:
                    logger.warning(
                        f"Failed to extract text from MessageOutputItem: {e}"
                    )
                    # Fallback: try to extract text from raw_item attributes
                    try:
                        if hasattr(item.raw_item, "content") and item.raw_item.content:
                            message["content"] = str(
                                item.raw_item.content[0].text
                                if hasattr(item.raw_item.content[0], "text")
                                else ""
                            )
                        else:
                            message["content"] = ""
                    except Exception:
                        logger.exception(
                            "Failed to extract text from raw_item fallback"
                        )
                        message["content"] = ""
                # Also store the complete message item
                message["message_item_data"] = safe_serialize_openai_object(item)

        # Skip RawResponsesStreamEvent - these create noise (62 empty events)
        # Token usage will be captured from meaningful events instead

        # Handle agent updates (store complete agent data)
        elif isinstance(event, AgentUpdatedStreamEvent):
            message["last_agent"] = event.new_agent.name
            message["agent_type"] = event.new_agent.name.lower()
            # Complete agent data is already stored in event_data above

        return message

    async def _save_conversation_message_async(self, message_data: dict):
        """Save conversation message to database asynchronously"""
        try:
            # Import here to avoid circular dependency

            from ..database import get_db
            from ..models import ConversationMessage

            # Create a new database session for async operation
            db = next(get_db())

            # Check if message already exists (prevent duplicates)
            existing = (
                db.query(ConversationMessage)
                .filter(ConversationMessage.id == message_data["id"])
                .first()
            )

            if not existing:
                # Create and save the message
                message = ConversationMessage(
                    id=message_data["id"],
                    session_id=message_data["session_id"],
                    role=message_data["role"],
                    message_type=message_data.get("message_type", "stream_event"),
                    content=message_data.get("content"),
                    iteration=message_data.get("iteration"),
                    stream_event_type=message_data.get("stream_event_type"),
                    stream_sequence=message_data.get("stream_sequence"),
                    event_data=message_data.get("event_data"),
                    tool_calls=message_data.get("tool_calls"),
                    tool_outputs=message_data.get("tool_outputs"),
                    handoffs=message_data.get("handoffs"),
                    last_agent=message_data.get("last_agent"),
                    usage_input_tokens=(
                        message_data.get("token_usage", {}).get("input_tokens")
                        if message_data.get("token_usage")
                        else None
                    ),
                    usage_output_tokens=(
                        message_data.get("token_usage", {}).get("output_tokens")
                        if message_data.get("token_usage")
                        else None
                    ),
                    usage_total_tokens=(
                        message_data.get("token_usage", {}).get("total_tokens")
                        if message_data.get("token_usage")
                        else None
                    ),
                    usage_cached_tokens=message_data.get("usage_cached_tokens"),
                    usage_reasoning_tokens=message_data.get("usage_reasoning_tokens"),
                    # Legacy fields
                    token_usage=message_data.get("token_usage"),
                    openai_response={},  # Store minimal data for now
                )

                db.add(message)
                db.commit()
                logger.info(
                    f"Saved conversation message {message_data['id']} for session {message_data['session_id']}, sequence {message_data.get('stream_sequence')}"
                )
            else:
                logger.info(
                    f"Message {message_data['id']} already exists, skipping save"
                )

            db.close()

        except Exception as e:
            logger.error(f"Error saving conversation message: {e}", exc_info=True)

    async def handle_human_rejection(
        self,
        diff_id: str,
        feedback: str,
        project_id: str,
        project_slug: str,
        current_code: str,
    ):
        """Handle human rejection of a diff"""
        # Get rejected diff
        # Create new prompt with human feedback
        prompt = f"The human reviewer rejected the changes with this feedback: {feedback}\n\nPlease address the feedback and try again."

        # Call vibecode() again with new prompt
        return await self.vibecode(
            project_id=project_id,
            prompt=prompt,
            current_code=current_code,
            project_slug=project_slug,
        )


# KUI TODO: we may not need this in the future.
# Global instance
vibecode_service = VibecodeService()
