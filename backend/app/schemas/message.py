from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel


class MessageCreate(BaseModel):
    prompt: str


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    openai_response: Optional[Dict[str, Any]] = None
    token_usage: Optional[Dict[str, Any]] = None
    diff_id: Optional[str] = None
    last_response_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
