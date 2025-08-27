from datetime import datetime
from typing import Any

from pydantic import BaseModel


class MessageCreate(BaseModel):
    prompt: str


class MessageResponse(BaseModel):
    """Comprehensive response schema that matches the updated ConversationMessage model"""

    # Core identification
    id: str
    session_id: str

    # Message categorization
    role: str
    message_type: str | None = None  # 'user_input' | 'run_result' | 'stream_event'

    # Common RunResult fields
    input: dict[str, Any] | list[dict[str, Any]] | None = None
    new_items: list[dict[str, Any]] | None = None
    final_output: str | None = None
    final_output_typed: dict[str, Any] | None = None
    last_agent: str | None = None

    # Tool tracking (typed fields)
    tool_calls: list[dict[str, Any]] | None = None
    tool_outputs: list[dict[str, Any]] | None = None
    handoffs: list[dict[str, Any]] | None = None

    # Token usage (properly typed)
    usage_input_tokens: int | None = None
    usage_output_tokens: int | None = None
    usage_total_tokens: int | None = None
    usage_cached_tokens: int | None = None
    usage_reasoning_tokens: int | None = None

    # Streaming metadata
    stream_event_type: str | None = None
    stream_sequence: int | None = None
    event_data: dict[str, Any] | None = None

    # Legacy fields (for backward compatibility)
    content: str | None = None
    iteration: int | None = None
    openai_response: dict[str, Any] | None = None
    token_usage: dict[str, Any] | None = None
    diff_id: str | None = None
    last_response_id: str | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
