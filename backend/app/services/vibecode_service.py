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

from ..agents.all_agents import vibecode_service as agent_vibecode_service
from ..database import get_db
from ..models import ConversationMessage, Diff, Project, VibecodeSession
from ..services.socketio_service import socketio_manager

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
        node_id: Optional[str] = None
    ) -> Dict[str, Any]:
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
                socketio_manager=socketio_manager
            )
            
            # Convert result to dict format expected by API
            response = {
                "content": result.content,
                "diff_id": result.diff_id,
                "patch": None,  # We don't expose raw patches in the API
                "token_usage": {"total_tokens": 0},  # Will be populated from actual usage
                "error": None
            }
            
            # If we have a diff, create it in the database
            if result.diff_id and result.content:  # content contains commit message
                diff = Diff(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    session_id=session_id,
                    patch_content="",  # Will be filled from actual patch
                    commit_message=result.content or "Auto-generated commit",
                    status="evaluator_approved",
                    evaluator_reasoning="Approved by evaluator",
                    created_at=datetime.utcnow()
                )
                db.add(diff)
                db.commit()
                response["diff_id"] = diff.id
            
            # Extract token usage if available
            if hasattr(result, 'openai_response') and result.openai_response:
                if hasattr(result.openai_response, 'usage'):
                    usage = result.openai_response.usage
                    response["token_usage"] = {
                        "total_tokens": usage.total_tokens if hasattr(usage, 'total_tokens') else 0,
                        "prompt_tokens": usage.prompt_tokens if hasattr(usage, 'prompt_tokens') else 0,
                        "completion_tokens": usage.completion_tokens if hasattr(usage, 'completion_tokens') else 0
                    }
            
            return response
            
        except Exception as e:
            logger.error(f"Vibecode error: {e}", exc_info=True)
            return {"error": str(e)}


# Global instance
vibecode_service = VibecodeService()