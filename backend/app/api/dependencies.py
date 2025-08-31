"""
Common dependencies for API endpoints
Eliminates duplicate validation code across endpoints
"""

from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Diff, Project, VibecodeSession


async def get_valid_project(project_id: str, db: Session = Depends(get_db)) -> Project:
    """
    Dependency to validate and retrieve a project.
    Raises HTTPException if project not found.
    Used across all project-related endpoints.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def get_valid_project_by_slug(
    project_slug: str, db: Session = Depends(get_db)
) -> Project:
    """
    Dependency to validate and retrieve a project by slug.
    Raises HTTPException if project not found.
    """
    project = db.query(Project).filter(Project.slug == project_slug).first()
    if not project:
        raise HTTPException(
            status_code=404, detail=f"Project with slug '{project_slug}' not found"
        )
    return project


async def get_valid_session(
    session_id: str, db: Session = Depends(get_db)
) -> VibecodeSession:
    """
    Dependency to validate and retrieve a session.
    Raises HTTPException if session not found.
    Used across all session-related endpoints.
    """
    session = db.query(VibecodeSession).filter(VibecodeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def get_valid_project_and_session(
    project_id: str, session_id: str, db: Session = Depends(get_db)
) -> tuple[Project, VibecodeSession]:
    """
    Dependency to validate both project and session.
    Also verifies that the session belongs to the project.
    """
    project = await get_valid_project(project_id, db)
    session = await get_valid_session(session_id, db)

    # Verify session belongs to project
    if session.project_id != project.id:
        raise HTTPException(
            status_code=400,
            detail=f"Session {session_id} does not belong to project {project_id}",
        )

    return project, session


async def get_valid_diff(diff_id: str, db: Session = Depends(get_db)) -> Diff:
    """
    Dependency to validate and retrieve a diff.
    Raises HTTPException if diff not found.
    """
    diff = db.query(Diff).filter(Diff.id == diff_id).first()
    if not diff:
        raise HTTPException(status_code=404, detail="Diff not found")
    return diff


async def get_valid_project_diff(
    project_id: str, diff_id: str, db: Session = Depends(get_db)
) -> tuple[Project, Diff]:
    """
    Dependency to validate project and diff.
    Also verifies that the diff belongs to the project.
    """
    project = await get_valid_project(project_id, db)
    diff = await get_valid_diff(diff_id, db)

    # Verify diff belongs to project
    if diff.project_id != project.id:
        raise HTTPException(
            status_code=400,
            detail=f"Diff {diff_id} does not belong to project {project_id}",
        )

    return project, diff


# Type aliases for cleaner function signatures
ValidProject = Annotated[Project, Depends(get_valid_project)]
ValidProjectBySlug = Annotated[Project, Depends(get_valid_project_by_slug)]
ValidSession = Annotated[VibecodeSession, Depends(get_valid_session)]
ValidDiff = Annotated[Diff, Depends(get_valid_diff)]
DatabaseSession = Annotated[Session, Depends(get_db)]
