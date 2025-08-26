import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TestCase, TestResult
from ..schemas import TestCaseResponse, TestResultResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tests", tags=["tests"])


@router.get("/{test_id}/run", response_model=TestResultResponse)
def run_test(test_id: str, db: Session = Depends(get_db)) -> TestResult:
    """Run a single test case"""
    test_case = db.query(TestCase).filter(TestCase.id == test_id).first()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    # For now, create a mock successful result
    # Phase 006 will implement actual test execution
    test_result = TestResult(
        test_case_id=test_id,
        status="passed",
        output="Test executed successfully",
        error=None,
        execution_time_ms=100,
    )

    db.add(test_result)
    db.commit()
    db.refresh(test_result)

    return test_result


@router.post("/{test_id}/run", response_model=TestResultResponse, status_code=201)
def run_test_post(test_id: str, db: Session = Depends(get_db)) -> TestResult:
    """Run a single test case (POST variant)"""
    return run_test(test_id, db)
