from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    session_type: Literal["global", "node", "vibecode"] = Field(default="vibecode")
    node_id: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    project_id: str
    initial_prompt: Optional[str] = None
    current_code: Optional[str] = None
    openai_session_key: Optional[str] = None
    conversations_db_path: Optional[str] = None
    session_type: Optional[str] = None
    node_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
