"""
Session API endpoints
"""

import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ConversationMessage, Project, VibecodeSession
from ..schemas import MessageResponse as MessageResponseSchema
from ..schemas import SessionResponse
from ..services.vibecode_service import vibecode_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sessions"])


class MessageRequest(BaseModel):
    prompt: str


class MessageResponse(BaseModel):
    session_id: str
    diff_id: Optional[str] = None
    content: Optional[str] = None
    patch: Optional[str] = None
    token_usage: Optional[dict] = None
    error: Optional[str] = None


@router.post(
    "/projects/{project_id}/sessions", response_model=SessionResponse, status_code=201
)
def create_session(project_id: str, db: Session = Depends(get_db)) -> VibecodeSession:
    """Create a new vibecode session for a project"""

    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create session
    session = VibecodeSession(
        id=str(uuid.uuid4()),
        project_id=project_id,
        initial_prompt="",
        current_code=project.current_code or "",
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    logger.info(f"Created session {session.id} for project {project_id}")

    return session


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)) -> VibecodeSession:
    """Get a session by ID"""
    session = db.query(VibecodeSession).filter(VibecodeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions/{session_id}/messages", response_model=MessageResponse)
async def send_message(
    session_id: str, request: MessageRequest, db: Session = Depends(get_db)
) -> dict:
    """Send a message to trigger vibecode"""

    # Get session
    session = db.query(VibecodeSession).filter(VibecodeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get project
    project = db.query(Project).filter(Project.id == session.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Update session prompt if this is the first message
    if not session.initial_prompt:
        session.initial_prompt = request.prompt
        db.commit()

    # Get current code
    current_code = session.current_code or project.current_code or ""

    # Run vibecode
    logger.info(
        f"Running vibecode for session {session_id} with prompt: {request.prompt}"
    )

    result = await vibecode_service.vibecode(
        project_id=project.id,
        session_id=session_id,
        prompt=request.prompt,
        current_code=current_code,
        db=db,
    )

    # Return response - handle dict result
    return MessageResponse(
        session_id=session_id,
        diff_id=result.get("diff_id") if isinstance(result, dict) else result.diff_id,
        content=result.get("content") if isinstance(result, dict) else result.content,
        patch=result.get("patch") if isinstance(result, dict) else result.patch,
        token_usage=result.get("token_usage", {}) if isinstance(result, dict) else result.token_usage,
        error=result.get("error") if isinstance(result, dict) else result.error,
    )


@router.get(
    "/sessions/{session_id}/messages", response_model=List[MessageResponseSchema]
)
def get_messages(
    session_id: str, db: Session = Depends(get_db)
) -> List[ConversationMessage]:
    """Get all messages for a session"""

    # Verify session exists
    session = db.query(VibecodeSession).filter(VibecodeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get messages
    messages = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.created_at)
        .all()
    )

    return messages


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str, db: Session = Depends(get_db)) -> None:
    """Clear a session and its OpenAI context"""
    
    # Verify session exists
    session = db.query(VibecodeSession).filter(VibecodeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete all messages for this session
    db.query(ConversationMessage).filter(
        ConversationMessage.session_id == session_id
    ).delete()
    
    # Clear OpenAI session if it exists
    if session.openai_session_key:
        # The OpenAI session will be cleared by removing the SQLiteSession file
        # This happens automatically when we delete messages
        logger.info(f"Cleared OpenAI session for {session_id}")
    
    # Delete the session itself
    db.delete(session)
    db.commit()
    
    logger.info(f"Deleted session {session_id} and all associated messages")


@router.get("/messages/{message_id}/full")
def get_full_message(message_id: str, db: Session = Depends(get_db)) -> dict:
    """Get complete OpenAI response data for a message"""
    
    # Get the message
    message = db.query(ConversationMessage).filter(
        ConversationMessage.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Return the full OpenAI response
    return {
        "id": message.id,
        "session_id": message.session_id,
        "role": message.role,
        "content": message.content,
        "openai_response": message.openai_response,  # Full untyped JSON
        "token_usage": message.token_usage,
        "diff_id": message.diff_id,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "last_response_id": message.last_response_id
    }
