import uuid

from sqlalchemy import JSON, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class ConversationMessage(Base, TimestampMixin):
    """
    Comprehensive ConversationMessage model that handles all OpenAI RunResult types.
    Supports user messages, run results, and streaming events.
    """

    __tablename__ = "conversation_messages"

    # Core identification
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("vibecode_sessions.id"), nullable=False)

    # Message categorization
    role = Column(String, nullable=False)  # 'user' | 'assistant' | 'system'
    message_type = Column(
        String, nullable=False, default="user_input"
    )  # 'user_input' | 'run_result' | 'stream_event'

    # Common RunResult fields (extracted from RunResultBase)
    input = Column(JSON, nullable=True)  # Original input (str or list of items)
    new_items = Column(JSON, nullable=True)  # List of RunItems generated
    final_output = Column(Text, nullable=True)  # Final output as text (if string)
    final_output_typed = Column(JSON, nullable=True)  # Final output if structured
    last_agent = Column(String, nullable=True)  # Name of last agent that ran

    # Tool call tracking (typed fields)
    tool_calls = Column(JSON, nullable=True)  # Array of tool calls
    tool_outputs = Column(JSON, nullable=True)  # Array of tool outputs
    handoffs = Column(JSON, nullable=True)  # Handoff details if any

    # Token usage (properly typed)
    usage_input_tokens = Column(Integer, nullable=True)
    usage_output_tokens = Column(Integer, nullable=True)
    usage_total_tokens = Column(Integer, nullable=True)
    usage_cached_tokens = Column(Integer, nullable=True)
    usage_reasoning_tokens = Column(Integer, nullable=True)

    # Streaming metadata
    stream_event_type = Column(String, nullable=True)  # Event type for stream events
    stream_sequence = Column(Integer, nullable=True)  # Sequence number for ordering
    event_data = Column(JSON, nullable=True)  # Complete event payload

    # Legacy fields (keep for backward compatibility)
    content = Column(Text, nullable=True)  # Display content
    iteration = Column(Integer, nullable=True)
    openai_response = Column(JSON, nullable=True)  # Full response object
    token_usage = Column(JSON, nullable=True)  # Legacy token format
    diff_id = Column(String, ForeignKey("diffs.id"), nullable=True)
    last_response_id = Column(String, nullable=True)

    # Relationships
    session = relationship("VibecodeSession", backref="messages")
    diff = relationship("Diff", backref="messages", foreign_keys=[diff_id])
