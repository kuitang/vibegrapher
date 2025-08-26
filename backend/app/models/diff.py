import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class Diff(Base, TimestampMixin):
    __tablename__ = "diffs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("vibecode_sessions.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)

    base_commit = Column(String, nullable=False)
    target_branch = Column(String, nullable=False)
    diff_content = Column(Text, nullable=False)

    status = Column(String, nullable=False)

    test_results = Column(Text, nullable=True)
    tests_run_at = Column(DateTime, nullable=True)

    vibecoder_prompt = Column(Text, nullable=False)
    evaluator_reasoning = Column(Text, nullable=False)
    commit_message = Column(Text, nullable=False)
    human_feedback = Column(Text, nullable=True)
    committed_sha = Column(String, nullable=True)

    session = relationship("VibecodeSession", backref="diffs")
    project = relationship("Project", backref="diffs")
