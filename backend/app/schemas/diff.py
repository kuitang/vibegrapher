from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class DiffResponse(BaseModel):
    id: str
    session_id: str
    project_id: str
    base_commit: str
    target_branch: str
    diff_content: str
    status: Literal["evaluator_approved", "human_rejected", "committed"]
    test_results: Optional[str] = None
    tests_run_at: Optional[datetime] = None
    vibecoder_prompt: str
    evaluator_reasoning: str
    commit_message: str
    human_feedback: Optional[str] = None
    committed_sha: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
