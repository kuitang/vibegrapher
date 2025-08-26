import uuid

from sqlalchemy import Column, String, Text, UniqueConstraint

from .base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True)
    repository_path = Column(String, nullable=True)
    current_code = Column(Text, nullable=True)
    current_commit = Column(String, nullable=True)
    current_branch = Column(String, nullable=True, default="main")

    __table_args__ = (UniqueConstraint("slug", name="uq_project_slug"),)
