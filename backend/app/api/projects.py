import logging

from fastapi import APIRouter, Depends, HTTPException
from slugify import slugify
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Project, TestCase
from ..schemas import ProjectCreate, ProjectResponse, TestCaseResponse
from ..services.git_service import git_service
from .dependencies import DatabaseSession, ValidProject

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return projects


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    project_data: ProjectCreate, db: Session = Depends(get_db)
) -> Project:
    base_slug = slugify(project_data.name)
    slug = base_slug
    counter = 1

    while db.query(Project).filter(Project.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create git repository
    repository_path = git_service.create_repository(slug)
    if not repository_path:
        raise HTTPException(status_code=500, detail="Failed to create repository")

    # Get initial state
    current_branch = git_service.get_current_branch(slug)

    # Create initial commit with starter code
    initial_code = f"""# Welcome to Vibegrapher
# Project: {project_data.name}

def main():
    \"\"\"Main entry point for the application.\"\"\"
    print("Ready for vibecoding!")

if __name__ == "__main__":
    main()
"""

    # Make initial commit
    initial_commit = git_service.commit_changes(
        slug, initial_code, "Initial project setup", filename="main.py"
    )

    if not initial_commit:
        logger.warning(f"Failed to create initial commit for project {slug}")
    else:
        logger.info(f"Created initial commit {initial_commit} for project {slug}")

    project = Project(
        name=project_data.name,
        slug=slug,
        repository_path=repository_path,
        current_branch=current_branch,
        current_code=initial_code,
        current_commit=initial_commit,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project: ValidProject, db: DatabaseSession) -> Project:
    # Update current code and commit from git
    project.current_code = git_service.get_current_code(project.slug)
    project.current_commit = git_service.get_head_commit(project.slug)
    project.current_branch = git_service.get_current_branch(project.slug)

    db.commit()
    db.refresh(project)

    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project: ValidProject, db: DatabaseSession) -> None:
    # Delete git repository
    git_service.delete_repository(project.slug)

    db.delete(project)
    db.commit()


@router.get("/{project_id}/tests", response_model=list[TestCaseResponse])
def get_project_tests(project: ValidProject, db: DatabaseSession) -> list[TestCase]:
    """Get all test cases for a project"""
    tests = db.query(TestCase).filter(TestCase.project_id == project.id).all()
    return tests


@router.get("/{project_id}/files")
def get_project_files(project: ValidProject):
    """Get list of files in a project repository"""
    # For now, return a simple structure indicating main.py exists
    # In a real implementation, this would list actual git repository files
    return [{"name": "main.py", "path": "main.py", "type": "file"}]


@router.get("/{project_id}/files/{file_path:path}")
def get_project_file(project: ValidProject, file_path: str):
    """Get content of a specific file in a project"""
    # For main.py, return the current code
    if file_path == "main.py":
        return {"content": project.current_code, "path": file_path}

    raise HTTPException(status_code=404, detail="File not found")
