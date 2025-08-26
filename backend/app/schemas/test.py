from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TestCaseBase(BaseModel):
    name: str
    code: str
    quick_test: bool = False


class TestCaseCreate(TestCaseBase):
    pass


class TestCaseResponse(TestCaseBase):
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestResultBase(BaseModel):
    status: str  # "passed", "failed", "error"
    output: Optional[str] = None
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None


class TestResultCreate(TestResultBase):
    test_case_id: str


class TestResultResponse(TestResultBase):
    id: str
    test_case_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True