from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class DiffResponse(BaseModel):
    id: str
    session_id: str
    project_id: str
    base_commit: str
    target_branch: str
    diff_content: str
    status: Literal[
        "evaluator_approved", "human_approved", "human_rejected", "committed"
    ]
    test_results: str | None = None
    tests_run_at: datetime | None = None
    vibecoder_prompt: str
    evaluator_reasoning: str
    commit_message: str
    human_feedback: str | None = None
    committed_sha: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
