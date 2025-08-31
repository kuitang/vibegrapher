import uuid

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class VibecodeSession(Base, TimestampMixin):
    __tablename__ = "vibecode_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    openai_session_key = Column(String, unique=True, nullable=True)
    conversations_db_path = Column(String, nullable=True)
    session_type = Column(String, nullable=True, default="vibecode")
    node_id = Column(String, nullable=True)

    project = relationship("Project", backref="sessions")
