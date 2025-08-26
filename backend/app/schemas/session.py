from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    session_type: Literal["global", "node"] = Field(default="global")
    node_id: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    project_id: str
    openai_session_key: str
    conversations_db_path: str
    session_type: str
    node_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
