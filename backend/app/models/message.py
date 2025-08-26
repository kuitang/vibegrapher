import uuid

from sqlalchemy import JSON, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class ConversationMessage(Base, TimestampMixin):
    __tablename__ = "conversation_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("vibecode_sessions.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    iteration = Column(Integer, nullable=True)
    openai_response = Column(JSON, nullable=True)
    token_usage = Column(JSON, nullable=True)
    diff_id = Column(String, ForeignKey("diffs.id"), nullable=True)
    last_response_id = Column(String, nullable=True)
    
    # New fields for richer message types
    message_type = Column(String, nullable=True)  # 'message', 'tool_call', 'tool_result'
    agent_type = Column(String, nullable=True)  # 'vibecoder', 'evaluator'
    tool_calls = Column(JSON, nullable=True)  # Store tool call details

    session = relationship("VibecodeSession", backref="messages")
    diff = relationship("Diff", backref="messages", foreign_keys=[diff_id])
