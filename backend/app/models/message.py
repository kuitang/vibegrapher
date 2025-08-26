import uuid

from sqlalchemy import JSON, Column, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class ConversationMessage(Base, TimestampMixin):
    __tablename__ = "conversation_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("vibecode_sessions.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    openai_response = Column(JSON, nullable=True)
    token_usage = Column(JSON, nullable=True)
    diff_id = Column(String, ForeignKey("diffs.id"), nullable=True)
    last_response_id = Column(String, nullable=True)

    session = relationship("VibecodeSession", backref="messages")
    diff = relationship("Diff", backref="messages", foreign_keys=[diff_id])
