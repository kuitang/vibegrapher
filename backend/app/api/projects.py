import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from slugify import slugify
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Project
from ..schemas import ProjectCreate, ProjectResponse

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

    repository_path = os.path.join(settings.media_path, "projects", slug)

    project = Project(
        name=project_data.name,
        slug=slug,
        repository_path=repository_path,
        current_branch="main",
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
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)) -> None:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()
