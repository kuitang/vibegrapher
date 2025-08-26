"""
Vibecode Service - Orchestrates VibeCoder and Evaluator agents
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from ..agents.all_agents import (
    EvaluationResult,
    evaluator_agent,
    validate_patch,
    vibecoder_agent,
)
from ..database import get_db
from ..models import ConversationMessage, Diff, Project, VibecodeSession
from ..services.socketio_service import socketio_manager

logger = logging.getLogger(__name__)


class VibecodeResult:
    """Result from vibecode operation"""
    def __init__(
        self,
        content: Optional[str] = None,
        diff_id: Optional[str] = None,
        patch: Optional[str] = None,
        token_usage: Optional[Dict[str, int]] = None,
        error: Optional[str] = None
    ):
        self.content = content
        self.diff_id = diff_id
        self.patch = patch
        self.token_usage = token_usage or {}
        self.error = error
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "diff_id": self.diff_id,
            "patch": self.patch,
            "token_usage": self.token_usage,
            "error": self.error
        }


class VibecodeService:
    """Service for running vibecode operations"""
    
    def __init__(self):
        self.last_iteration_count = 0
    
    async def vibecode(
        self,
        project_id: str,
        session_id: str,
        prompt: str,
        current_code: str,
        db: Session,
        node_id: Optional[str] = None
    ) -> VibecodeResult:
        """
        Run vibecode operation with VibeCoder and Evaluator agents
        
        CRITICAL: Real-time streaming of AI responses via Socket.io
        """
        
        # Get project for room ID
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return VibecodeResult(error="Project not found")
        
        room_id = f"project_{project_id}"
        total_tokens = 0
        evaluator_feedback = None
        
        # MAX 3 iterations
        for iteration in range(3):
            self.last_iteration_count = iteration + 1
            
            # Run VibeCoder
            logger.info(f"Running VibeCoder iteration {iteration + 1}")
            vibecoder_response = await vibecoder_agent.generate(
                prompt=prompt,
                current_code=current_code,
                evaluator_feedback=evaluator_feedback
            )
            
            # Track tokens
            if vibecoder_response.get("usage"):
                usage = vibecoder_response["usage"]
                total_tokens += usage.get("total_tokens", 0)
            
            # CRITICAL: Stream VibeCoder response immediately
            await self._stream_agent_response(
                response=vibecoder_response,
                agent_type="vibecoder",
                iteration=iteration,
                session_id=session_id,
                room_id=room_id,
                db=db
            )
            
            # Check response type
            if vibecoder_response["type"] == "text":
                # Text response - return immediately
                return VibecodeResult(
                    content=vibecoder_response["content"],
                    token_usage={"total_tokens": total_tokens}
                )
            
            elif vibecoder_response["type"] == "patch":
                # Validate patch
                patch = vibecoder_response["patch"]
                validation = validate_patch(current_code, patch)
                
                if not validation.valid:
                    # Invalid patch - return error
                    error_msg = f"Patch validation failed: {validation.error}"
                    logger.error(error_msg)
                    
                    # Stream error message
                    await socketio_manager.emit_to_room(
                        room_id,
                        "validation_error",
                        {"error": validation.error, "iteration": iteration}
                    )
                    
                    # Set feedback for next iteration
                    evaluator_feedback = f"Previous patch had syntax error: {validation.error}"
                    continue
                
                # Run Evaluator
                logger.info(f"Running Evaluator for iteration {iteration + 1}")
                eval_result = await evaluator_agent.evaluate(
                    original_code=current_code,
                    patched_code=validation.patched_code,
                    patch_description=vibecoder_response["description"],
                    user_prompt=prompt
                )
                
                # Track evaluator tokens
                # Note: Our evaluator doesn't return usage directly, would need to modify
                
                # CRITICAL: Stream Evaluator response immediately
                eval_response = {
                    "approved": eval_result.approved,
                    "reasoning": eval_result.reasoning,
                    "commit_message": eval_result.commit_message
                }
                
                await self._stream_agent_response(
                    response=eval_response,
                    agent_type="evaluator",
                    iteration=iteration,
                    session_id=session_id,
                    room_id=room_id,
                    db=db
                )
                
                if eval_result.approved:
                    # Create Diff record
                    diff = Diff(
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        original_code=current_code,
                        modified_code=validation.patched_code,
                        patch=patch,
                        status="evaluator_approved",
                        commit_message=eval_result.commit_message,
                        evaluator_reasoning=eval_result.reasoning
                    )
                    db.add(diff)
                    db.commit()
                    
                    logger.info(f"Diff approved and saved: {diff.id}")
                    
                    # Emit diff created event
                    await socketio_manager.emit_to_room(
                        room_id,
                        "diff_created",
                        {
                            "diff_id": diff.id,
                            "commit_message": eval_result.commit_message,
                            "session_id": session_id
                        }
                    )
                    
                    return VibecodeResult(
                        diff_id=diff.id,
                        patch=patch,
                        token_usage={"total_tokens": total_tokens}
                    )
                else:
                    # Not approved - set feedback for next iteration
                    evaluator_feedback = f"Evaluator feedback: {eval_result.reasoning}"
                    logger.info(f"Patch rejected, iterating with feedback")
        
        # Max iterations reached without approval
        logger.warning("Max iterations reached without patch approval")
        return VibecodeResult(
            error="Max iterations reached without approval",
            token_usage={"total_tokens": total_tokens}
        )
    
    async def _stream_agent_response(
        self,
        response: Dict[str, Any],
        agent_type: str,
        iteration: int,
        session_id: str,
        room_id: str,
        db: Session
    ):
        """
        Stream agent response via Socket.io (priority #1)
        Then save to database asynchronously (priority #2)
        """
        
        # 1. IMMEDIATELY emit Socket.io event (no delay)
        event_data = {
            "agent_type": agent_type,
            "iteration": iteration,
            "session_id": session_id,
            "timestamp": datetime.utcnow().isoformat(),
            "content": response
        }
        
        await socketio_manager.emit_to_room(
            room_id,
            "conversation_message",
            event_data
        )
        
        logger.info(f"Streamed {agent_type} response for iteration {iteration}")
        
        # 2. Save to database in background (fire-and-forget)
        asyncio.create_task(
            self._save_conversation_message_async(
                response, agent_type, iteration, session_id, db
            )
        )
    
    async def _save_conversation_message_async(
        self,
        response: Dict[str, Any],
        agent_type: str,
        iteration: int,
        session_id: str,
        db: Session
    ):
        """Save conversation message to database (background task)"""
        try:
            message = ConversationMessage(
                session_id=session_id,
                role=agent_type,
                content=json.dumps(response),
                iteration=iteration
            )
            db.add(message)
            db.commit()
            logger.debug(f"Saved {agent_type} message to database")
        except Exception as e:
            logger.error(f"Error saving conversation message: {e}")
    
    async def handle_human_rejection(
        self,
        diff_id: str,
        feedback: str,
        db: Session
    ) -> VibecodeResult:
        """Handle human rejection of a diff"""
        
        # Get rejected diff
        diff = db.query(Diff).filter(Diff.id == diff_id).first()
        if not diff:
            return VibecodeResult(error="Diff not found")
        
        # Update diff status
        diff.status = "human_rejected"
        diff.human_feedback = feedback
        db.commit()
        
        # Get session
        session = db.query(VibecodeSession).filter(
            VibecodeSession.id == diff.session_id
        ).first()
        if not session:
            return VibecodeResult(error="Session not found")
        
        # Create new prompt with human feedback
        new_prompt = f"""The previous patch was rejected with this feedback:
{feedback}

Please create a new patch that addresses this feedback.

Original request: {session.initial_prompt}"""
        
        # Run vibecode again with feedback
        return await self.vibecode(
            project_id=session.project_id,
            session_id=session.id,
            prompt=new_prompt,
            current_code=diff.original_code,
            db=db
        )


# Global instance
vibecode_service = VibecodeService()