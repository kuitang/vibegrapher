import uuid
from typing import Optional

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class TestCase(Base, TimestampMixin):
    __tablename__ = "test_cases"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    code = Column(Text, nullable=False)
    quick_test = Column(Boolean, default=False)

    project = relationship("Project", back_populates="test_cases")
    results = relationship(
        "TestResult", back_populates="test_case", cascade="all, delete-orphan"
    )


class TestResult(Base, TimestampMixin):
    __tablename__ = "test_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    test_case_id = Column(String, ForeignKey("test_cases.id", ondelete="CASCADE"))
    status = Column(String, nullable=False)  # "passed", "failed", "error"
    output = Column(Text)
    error = Column(Text)
    execution_time_ms = Column(Integer)

    test_case = relationship("TestCase", back_populates="results")