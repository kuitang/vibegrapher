"""
Diff API endpoints for human review workflow
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Diff, Project, VibecodeSession
from ..schemas import DiffResponse
from ..services.git_service import GitService
from ..utils.diff_parser import diff_parser

logger = logging.getLogger(__name__)

router = APIRouter(tags=["diffs"])


class ReviewRequest(BaseModel):
    approved: bool
    feedback: str | None = None


class CommitRequest(BaseModel):
    commit_message: str | None = None


class CommitResponse(BaseModel):
    diff_id: str
    committed_sha: str
    message: str


class RefineMessageRequest(BaseModel):
    prompt: str | None = None


@router.get("/projects/{project_id}/diffs", response_model=list[DiffResponse])
def get_project_diffs(
    project_id: str, status: str | None = None, db: Session = Depends(get_db)
) -> list[Diff]:
    """Get diffs for a project, optionally filtered by status"""
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Build query
    query = db.query(Diff).filter(Diff.project_id == project_id)

    # Apply status filter if provided
    if status:
        query = query.filter(Diff.status == status)

    # Get diffs ordered by creation time
    diffs = query.order_by(Diff.created_at.desc()).all()

    return diffs


@router.get("/sessions/{session_id}/diffs", response_model=list[DiffResponse])
def get_session_diffs(session_id: str, db: Session = Depends(get_db)) -> list[Diff]:
    """Get all diffs for a session"""
    # Verify session exists
    session = db.query(VibecodeSession).filter(VibecodeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all diffs for session
    diffs = (
        db.query(Diff)
        .filter(Diff.session_id == session_id)
        .order_by(Diff.created_at.desc())
        .all()
    )

    return diffs


@router.get("/sessions/{session_id}/diffs/pending", response_model=list[DiffResponse])
def get_pending_diffs(session_id: str, db: Session = Depends(get_db)) -> list[Diff]:
    """Get pending (evaluator_approved) diffs for a session"""
    # Verify session exists
    session = db.query(VibecodeSession).filter(VibecodeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get pending diffs
    diffs = (
        db.query(Diff)
        .filter(Diff.session_id == session_id, Diff.status == "evaluator_approved")
        .order_by(Diff.created_at.desc())
        .all()
    )

    return diffs


@router.get("/diffs/{diff_id}", response_model=DiffResponse)
def get_diff(diff_id: str, db: Session = Depends(get_db)) -> Diff:
    """Get a specific diff by ID"""
    diff = db.query(Diff).filter(Diff.id == diff_id).first()
    if not diff:
        raise HTTPException(status_code=404, detail="Diff not found")
    return diff


@router.get("/diffs/{diff_id}/preview")
def get_diff_preview(diff_id: str, db: Session = Depends(get_db)) -> dict:
    """Preview the result of applying a diff"""
    diff = db.query(Diff).filter(Diff.id == diff_id).first()
    if not diff:
        raise HTTPException(status_code=404, detail="Diff not found")

    # Get the project for current code
    project = db.query(Project).filter(Project.id == diff.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Apply patch to get preview
    current_code = project.current_code or ""
    preview = diff_parser.apply_patch(current_code, diff.diff_content)

    if preview is None:
        raise HTTPException(status_code=400, detail="Failed to apply patch")

    return {
        "diff_id": diff_id,
        "original_code": current_code,
        "preview_code": preview,
        "diff_content": diff.diff_content,
        "commit_message": diff.commit_message,
    }


@router.post("/diffs/{diff_id}/review", response_model=DiffResponse)
def review_diff(
    diff_id: str, request: ReviewRequest, db: Session = Depends(get_db)
) -> Diff:
    """Human approve or reject a diff with feedback"""
    logger.info(f"Review request for diff {diff_id}: approved={request.approved}")

    diff = db.query(Diff).filter(Diff.id == diff_id).first()
    if not diff:
        logger.warning(f"Diff {diff_id} not found in database")
        raise HTTPException(status_code=404, detail="Diff not found")

    if diff.status != "evaluator_approved":
        logger.warning(
            f"Attempted to review diff {diff_id} in wrong status: {diff.status}\n"
            f"Expected: evaluator_approved\n"
            f"This usually means the diff was already reviewed"
        )
        raise HTTPException(
            status_code=400,
            detail=f"Diff is not pending review (status: {diff.status})",
        )

    if request.approved:
        diff.status = "human_approved"
        logger.info(f"Diff {diff_id} approved by human")
    else:
        diff.status = "human_rejected"
        diff.human_feedback = request.feedback or "No feedback provided"
        logger.info(f"Diff {diff_id} rejected by human: {request.feedback}")
        # TODO: Trigger new vibecode iteration with feedback

    db.commit()
    db.refresh(diff)

    logger.debug(f"Diff {diff_id} review complete, new status: {diff.status}")
    return diff


@router.post("/diffs/{diff_id}/commit", response_model=CommitResponse)
async def commit_diff(
    diff_id: str, request: CommitRequest, db: Session = Depends(get_db)
) -> dict:
    """Commit an approved diff to git"""
    diff = db.query(Diff).filter(Diff.id == diff_id).first()
    if not diff:
        raise HTTPException(status_code=404, detail="Diff not found")

    if diff.status != "human_approved":
        raise HTTPException(
            status_code=400, detail=f"Diff is not approved (status: {diff.status})"
        )

    # Get project
    project = db.query(Project).filter(Project.id == diff.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Apply the diff
    current_code = project.current_code or ""
    new_code = diff_parser.apply_patch(current_code, diff.diff_content)

    if new_code is None:
        raise HTTPException(status_code=400, detail="Failed to apply patch")

    # Commit to git
    git_service = GitService()

    # Verify base commit matches
    current_commit = git_service.get_head_commit(project.slug)
    if current_commit != diff.base_commit:
        logger.error(
            f"Base commit mismatch for diff {diff_id}\n"
            f"Diff expects: {diff.base_commit}\n"
            f"Project has: {current_commit}\n"
            f"Project: {project.slug} (ID: {project.id})\n"
            f"Diff status: {diff.status}\n"
            f"Diff created: {diff.created_at}"
        )
        raise HTTPException(
            status_code=409,
            detail=f"Base commit mismatch. Expected: {diff.base_commit}, Current: {current_commit}",
        )

    # Write new code and commit
    commit_sha = git_service.commit_changes(
        project.slug,
        new_code,
        request.commit_message or diff.commit_message,
        filename="script.py",
    )

    # Update diff status
    diff.status = "committed"
    diff.committed_sha = commit_sha

    # Update project with new code and commit
    project.current_code = new_code
    project.current_commit = commit_sha

    db.commit()

    logger.info(f"Committed diff {diff_id} as {commit_sha}")

    # TODO: Clear evaluator context

    return CommitResponse(
        diff_id=diff_id,
        committed_sha=commit_sha,
        message=f"Successfully committed as {commit_sha[:8]}",
    )


@router.post("/diffs/{diff_id}/refine-message")
async def refine_commit_message(
    diff_id: str, request: RefineMessageRequest, db: Session = Depends(get_db)
) -> dict:
    """Get a refined commit message suggestion from evaluator"""
    diff = db.query(Diff).filter(Diff.id == diff_id).first()
    if not diff:
        raise HTTPException(status_code=404, detail="Diff not found")

    # TODO: Run evaluator agent to generate better commit message
    # For now, return enhanced version
    refined_message = diff.commit_message
    if request.prompt:
        refined_message = f"{diff.commit_message}\n\n{request.prompt}"

    return {
        "diff_id": diff_id,
        "original_message": diff.commit_message,
        "refined_message": refined_message,
        "suggestion": "Consider adding more context about the changes",
    }
