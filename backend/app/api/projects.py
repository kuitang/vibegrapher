import os
from typing import List
import logging

from fastapi import APIRouter, Depends, HTTPException
from slugify import slugify
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Project, TestCase
from ..schemas import ProjectCreate, ProjectResponse, TestCaseResponse
from ..services.git_service import git_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db)) -> List[Project]:
    projects = db.query(Project).all()
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
    
    project = Project(
        name=project_data.name,
        slug=slug,
        repository_path=repository_path,
        current_branch=current_branch,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Update current code and commit from git
    project.current_code = git_service.get_current_code(project.slug)
    project.current_commit = git_service.get_head_commit(project.slug)
    project.current_branch = git_service.get_current_branch(project.slug)
    
    db.commit()
    db.refresh(project)
    
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)) -> None:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete git repository
    git_service.delete_repository(project.slug)
    
    db.delete(project)
    db.commit()


@router.get("/{project_id}/tests", response_model=List[TestCaseResponse])
def get_project_tests(project_id: str, db: Session = Depends(get_db)) -> List[TestCase]:
    """Get all test cases for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tests = db.query(TestCase).filter(TestCase.project_id == project_id).all()
    return tests
