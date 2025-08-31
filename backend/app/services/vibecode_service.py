"""
Vibecode Service - Orchestrates VibeCoder and Evaluator agents
"""

import logging
import uuid
from typing import Any

from sqlalchemy.orm import Session

from ..agents.all_agents import vibecode_service as agent_vibecode_service
from ..models import Diff, Project
from ..services.socketio_service import socketio_manager
from ..utils.error_handling import log_and_format_error

logger = logging.getLogger(__name__)


class VibecodeService:
    """Service for running vibecode operations - wraps the agent service"""

    def __init__(self):
        self.agent_service = agent_vibecode_service

    async def vibecode(
        self,
        project_id: str,
        session_id: str,
        prompt: str,
        current_code: str,
        db: Session,
        node_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Run vibecode operation with VibeCoder and Evaluator agents

        CRITICAL: Real-time streaming of AI responses via Socket.io
        """

        # Get project for slug and room ID
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return {"error": "Project not found"}

        try:
            # Call the agent vibecode service
            result = await self.agent_service.vibecode(
                project_id=project_id,
                prompt=prompt,
                current_code=current_code,
                project_slug=project.slug,
                node_id=node_id,
                session_id=session_id,
                socketio_manager=socketio_manager,
            )

            # Convert result to dict format expected by API
            response = {
                "content": result.content,
                "diff_id": result.diff_id,
                "patch": None,  # We don't expose raw patches in the API
                "token_usage": {
                    "total_tokens": 0
                },  # Will be populated from actual usage
                "error": None,
            }

            # If we have a diff_id marker, create the actual diff in the database
            if result.diff_id == "generated-diff-id":
                # Extract patch and commit message from the openai response
                patch_content = ""
                commit_message = "Auto-generated commit"
                evaluator_reasoning = "Approved by evaluator"

                # Look for the evaluation result in the response
                if hasattr(result, "openai_response") and hasattr(
                    result.openai_response, "new_items"
                ):
                    for item in result.openai_response.new_items:
                        # Find the tool call with the patch
                        if hasattr(item, "raw_item") and hasattr(
                            item.raw_item, "arguments"
                        ):
                            import json

                            args = json.loads(item.raw_item.arguments)
                            if "patch" in args:
                                patch_content = args["patch"]
                        # Find the evaluation result
                        if hasattr(item, "output") and hasattr(
                            item.output, "commit_message"
                        ):
                            commit_message = item.output.commit_message
                            evaluator_reasoning = item.output.reasoning

                # Get the actual HEAD commit from the project
                from ..services.git_service import GitService

                git_service = GitService()

                # Get project to find slug (Project already imported at top)
                project = db.query(Project).filter(Project.id == project_id).first()

                # Get actual HEAD commit SHA or use project's current_commit
                base_commit = None
                if project:
                    if project.slug:
                        base_commit = git_service.get_head_commit(project.slug)
                    if not base_commit:
                        base_commit = project.current_commit

                # If still no commit, use a placeholder (should not happen in production)
                if not base_commit:
                    base_commit = "HEAD"

                # Create the diff
                diff = Diff(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    session_id=session_id,
                    diff_content=patch_content,  # Note: field is diff_content not patch_content
                    commit_message=commit_message,
                    status="evaluator_approved",
                    evaluator_reasoning=evaluator_reasoning,
                    base_commit=base_commit,  # Use actual commit SHA
                    target_branch="main",  # Required field
                    vibecoder_prompt=prompt,  # Required field - the original user prompt
                )
                db.add(diff)
                db.commit()
                response["diff_id"] = diff.id

            # Extract token usage if available
            if hasattr(result, "openai_response") and result.openai_response:
                if hasattr(result.openai_response, "context_wrapper"):
                    usage = result.openai_response.context_wrapper.usage
                    response["token_usage"] = {
                        "total_tokens": (
                            usage.total_tokens if hasattr(usage, "total_tokens") else 0
                        ),
                        "prompt_tokens": (
                            usage.input_tokens if hasattr(usage, "input_tokens") else 0
                        ),
                        "completion_tokens": (
                            usage.output_tokens
                            if hasattr(usage, "output_tokens")
                            else 0
                        ),
                    }
                elif hasattr(result.openai_response, "usage"):
                    usage = result.openai_response.usage
                    response["token_usage"] = {
                        "total_tokens": (
                            usage.total_tokens if hasattr(usage, "total_tokens") else 0
                        ),
                        "prompt_tokens": (
                            usage.input_tokens
                            if hasattr(usage, "input_tokens")
                            else (
                                usage.prompt_tokens
                                if hasattr(usage, "prompt_tokens")
                                else 0
                            )
                        ),
                        "completion_tokens": (
                            usage.output_tokens
                            if hasattr(usage, "output_tokens")
                            else (
                                usage.completion_tokens
                                if hasattr(usage, "completion_tokens")
                                else 0
                            )
                        ),
                    }

            return response

        except Exception as e:
            # Log error and get formatted error data with stack trace
            error_data = log_and_format_error(
                error=e, context="vibecode operation", logger_instance=logger
            )

            # Import here to avoid circular dependency
            import traceback
            from datetime import datetime

            from ..models import ConversationMessage

            # Format error message with stack trace for display
            error_text = f"ERROR: {e!s}\n\n"
            error_text += f"Type: {e.__class__.__name__}\n\n"
            error_text += "Stack Trace:\n"
            error_text += "=" * 60 + "\n"
            error_text += traceback.format_exc()
            error_text += "=" * 60

            # Create error message in database
            error_message = ConversationMessage(
                id=f"{session_id}_error_{uuid.uuid4().hex[:8]}",
                session_id=session_id,
                role="system",  # Use system role for errors
                message_type="error",
                content=error_text,  # Full error + stack trace as visible text
                event_data={
                    "error": str(e),
                    "error_type": e.__class__.__name__,
                    "stack_trace": traceback.format_exc(),
                    "context": f"vibecode operation - Session {session_id}",
                },
                stream_sequence=99999,  # High sequence to appear at end
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            db.add(error_message)
            db.commit()

            # Emit error as conversation_message so it appears in UI
            if socketio_manager and socketio_manager.sio:
                await socketio_manager.sio.emit(
                    "conversation_message",
                    {
                        "message_id": error_message.id,
                        "session_id": session_id,
                        "role": "system",
                        "message_type": "error",
                        "content": error_text,
                        "created_at": error_message.created_at.isoformat(),
                        "stream_sequence": 99999,
                    },
                    room=f"project_{project_id}",
                )

            return error_data


# Global instance
vibecode_service = VibecodeService()
