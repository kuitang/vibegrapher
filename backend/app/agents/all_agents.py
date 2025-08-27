"""
All OpenAI Agents for Vibegrapher
VibeCoder and Evaluator agents with patch submission workflow
"""

import ast
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from agents import Agent, Runner, SQLiteSession, function_tool
from agents.items import (
    HandoffOutputItem,
    ItemHelpers,
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

logger = logging.getLogger(__name__)

# Model configurations - use real OpenAI models for testing
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-4o-mini",  # Fast and cheap model for testing
    "SMALL_MODEL": "gpt-4o-mini",  # Fast and cheap model for testing
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
    patched_code = diff_parser.apply_patch(original, patch)

    if patched_code is None:
        return {"valid": False, "error": "Failed to apply patch: malformed diff format"}

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
    model=MODEL_CONFIGS["THINKING_MODEL"],
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

                # Build user prompt with current code
                user_prompt = f"Current code:\n```python\n{current_code}\n```\n\nUser request: {prompt}"

                # Run VibeCoder with streaming (run_streamed returns RunResultStreaming, not a coroutine)
                vibecoder_response = Runner.run_streamed(
                    vibecoder_agent, user_prompt, session=session
                )

                # Process stream events
                sequence_counter = 0
                last_sequence = -1
                evaluation = None

                async for event in vibecoder_response.stream_events():
                    sequence_counter += 1

                    # Check for sequence gaps
                    if last_sequence >= 0 and sequence_counter != last_sequence + 1:
                        logger.error(
                            f"❌ EVENT SEQUENCE GAP: Expected {last_sequence + 1}, got {sequence_counter}"
                        )
                    last_sequence = sequence_counter

                    # Create message from event
                    message = await self._create_message_from_event(
                        event, session_id, sequence_counter, iteration
                    )

                    collected_messages.append(message)

                    # Save to database immediately
                    await self._save_conversation_message_async(message)

                    # Emit via Socket.io immediately (no batching)
                    if socketio_manager and session_id and project_id:
                        await socketio_manager.emit_conversation_message(
                            session_id=session_id,
                            project_id=project_id,
                            message_id=message["id"],
                            role=message["role"],
                            agent=message.get("agent_type", "vibecoder"),
                            content=message.get("content", ""),
                            patch_preview=None,
                            iteration=iteration,
                            token_usage=message.get("token_usage"),
                        )

                    # Check if we got an evaluation result
                    if isinstance(event, RunItemStreamEvent):
                        if hasattr(event.item, "output") and isinstance(
                            event.item.output, EvaluationResult
                        ):
                            evaluation = event.item.output

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
                            else str(vibecoder_response)
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
            "content": None,
            "tool_calls": None,
            "tool_outputs": None,
            "handoffs": None,
            "agent_type": None,
            "token_usage": None,
        }

        # Extract data based on event type
        if isinstance(event, RunItemStreamEvent):
            item = event.item
            message["event_data"] = {
                "name": event.name,
                "item_type": item.__class__.__name__,
            }

            # Extract tool calls
            if isinstance(item, ToolCallItem):
                message["tool_calls"] = [
                    {
                        "type": item.raw_item.__class__.__name__,
                        "id": getattr(item.raw_item, "id", None),
                        "function": getattr(item.raw_item, "function", None),
                        "arguments": getattr(item.raw_item, "arguments", None),
                    }
                ]

            # Extract tool outputs
            elif isinstance(item, ToolCallOutputItem):
                message["tool_outputs"] = [
                    {
                        "tool_call_id": getattr(item.raw_item, "tool_call_id", None),
                        "output": str(item.output) if item.output else None,
                        "raw_output": str(item.raw_item),
                    }
                ]

            # Extract handoffs
            elif isinstance(item, HandoffOutputItem):
                message["handoffs"] = [
                    {
                        "source_agent": item.source_agent.name,
                        "target_agent": item.target_agent.name,
                    }
                ]

            # Extract message output
            elif isinstance(item, MessageOutputItem):
                try:
                    message["content"] = ItemHelpers.text_message_output(item.raw_item)
                except:
                    message["content"] = str(item.raw_item)

        # Extract token usage from raw responses
        elif isinstance(event, RawResponsesStreamEvent):
            message["event_data"] = {"type": "raw_response"}
            if hasattr(event.data, "usage"):
                usage = event.data.usage
                message["token_usage"] = {
                    "input_tokens": getattr(usage, "input_tokens", 0),
                    "output_tokens": getattr(usage, "output_tokens", 0),
                    "total_tokens": getattr(usage, "total_tokens", 0),
                }

                # Extract detailed token info if available
                if hasattr(usage, "input_tokens_details"):
                    message["usage_cached_tokens"] = getattr(
                        usage.input_tokens_details, "cached_tokens", 0
                    )
                if hasattr(usage, "output_tokens_details"):
                    message["usage_reasoning_tokens"] = getattr(
                        usage.output_tokens_details, "reasoning_tokens", 0
                    )

        # Handle agent updates
        elif isinstance(event, AgentUpdatedStreamEvent):
            message["event_data"] = {
                "type": "agent_updated",
                "new_agent": event.new_agent.name,
            }
            message["last_agent"] = event.new_agent.name
            message["agent_type"] = event.new_agent.name.lower()

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
