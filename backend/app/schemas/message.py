from datetime import datetime
from typing import Any

from pydantic import BaseModel


class MessageCreate(BaseModel):
    prompt: str


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    iteration: int | None = None
    openai_response: dict[str, Any] | None = None
    token_usage: dict[str, Any] | None = None
    diff_id: str | None = None
    last_response_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
