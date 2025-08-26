"""
Diff API endpoints
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Diff, VibecodeSession
from ..schemas import DiffResponse

router = APIRouter(prefix="/diffs", tags=["diffs"])


@router.get("/{diff_id}", response_model=DiffResponse)
def get_diff(diff_id: str, db: Session = Depends(get_db)) -> Diff:
    """Get a specific diff by ID"""
    diff = db.query(Diff).filter(Diff.id == diff_id).first()
    if not diff:
        raise HTTPException(status_code=404, detail="Diff not found")
    return diff


@router.get("/sessions/{session_id}/pending", response_model=List[DiffResponse])
def get_pending_diffs(session_id: str, db: Session = Depends(get_db)) -> List[Diff]:
    """Get all pending (evaluator_approved) diffs for a session"""
    
    # Verify session exists
    session = db.query(VibecodeSession).filter(VibecodeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get pending diffs
    diffs = db.query(Diff).filter(
        Diff.session_id == session_id,
        Diff.status == "evaluator_approved"
    ).all()
    
    return diffs


@router.post("/{diff_id}/approve", response_model=DiffResponse)
def approve_diff(diff_id: str, db: Session = Depends(get_db)) -> Diff:
    """Approve a diff (human approval)"""
    diff = db.query(Diff).filter(Diff.id == diff_id).first()
    if not diff:
        raise HTTPException(status_code=404, detail="Diff not found")
    
    diff.status = "human_approved"
    db.commit()
    db.refresh(diff)
    
    return diff


@router.post("/{diff_id}/reject", response_model=DiffResponse)
def reject_diff(
    diff_id: str,
    feedback: str,
    db: Session = Depends(get_db)
) -> Diff:
    """Reject a diff with feedback"""
    diff = db.query(Diff).filter(Diff.id == diff_id).first()
    if not diff:
        raise HTTPException(status_code=404, detail="Diff not found")
    
    diff.status = "human_rejected"
    diff.human_feedback = feedback
    db.commit()
    db.refresh(diff)
    
    # TODO: Trigger new vibecode iteration with feedback
    
    return diff