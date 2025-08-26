from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    session_type: Literal["global", "node", "vibecode"] = Field(default="vibecode")
    node_id: str | None = None


class SessionResponse(BaseModel):
    id: str
    project_id: str
    initial_prompt: str | None = None
    current_code: str | None = None
    openai_session_key: str | None = None
    conversations_db_path: str | None = None
    session_type: str | None = None
    node_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
