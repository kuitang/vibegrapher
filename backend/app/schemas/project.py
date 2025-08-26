from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    current_code: Optional[str] = None
    current_commit: Optional[str] = None
    current_branch: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    slug: str
    repository_path: Optional[str] = None
    current_code: Optional[str] = None
    current_commit: Optional[str] = None
    current_branch: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
