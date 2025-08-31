from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1)


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1)
    current_code: str | None = None
    current_commit: str | None = None
    current_branch: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    slug: str
    repository_path: str | None = None
    current_code: str | None = None
    current_commit: str | None = None
    current_branch: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
