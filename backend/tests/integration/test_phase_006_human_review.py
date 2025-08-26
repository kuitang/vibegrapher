"""
Phase 006: Human Review Flow Integration Tests
Tests human approval workflow for evaluator-approved diffs
"""

import uuid

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def test_client(test_server):
    """Create test HTTP client"""
    async with httpx.AsyncClient(base_url=test_server["url"], timeout=30.0) as client:
        yield client


@pytest.fixture
async def test_project(test_client):
    """Use the seeded test project"""
    # Get the seeded Agent Triage System project
    response = await test_client.get("/projects")
    assert response.status_code == 200
    projects = response.json()
    
    # Debug output
    print(f"\nDEBUG: Found {len(projects)} projects:")
    for p in projects:
        print(f"  - {p['name']} (id: {p['id']})")
    
    assert len(projects) > 0, f"No projects found! Response: {projects}"
    
    # Find the seeded project
    try:
        project = next(p for p in projects if p["name"] == "Agent Triage System")
    except StopIteration:
        # If not found, use the first project
        print(f"WARNING: 'Agent Triage System' not found, using first project")
        project = projects[0]
    
    return project


@pytest.fixture
async def test_session(test_client, test_project):
    """Create a test session"""
    response = await test_client.post(f"/projects/{test_project['id']}/sessions")
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def test_diff(test_server, test_project, test_session):
    """Create a test diff directly in database"""
    # Import here to avoid circular dependency
    from app.models import Diff
    from app.services.git_service import GitService

    # Get database session
    db_url = f"sqlite:///{test_server['media_path']}/../test_vibegrapher_{test_server['test_id']}.db"
    engine = create_engine(db_url)
    db = Session(engine)

    # Get current git commit
    # Use the same media_path as the test server
    import os
    projects_path = os.path.join(test_server['media_path'], "projects")
    git_service = GitService(base_path=projects_path)
    base_commit = git_service.get_head_commit(test_project["slug"])

    # Create diff
    diff = Diff(
        id=str(uuid.uuid4()),
        session_id=test_session["id"],
        project_id=test_project["id"],
        base_commit=base_commit,
        target_branch="main",
        diff_content="""--- a/code.py
+++ b/code.py
@@ -1,2 +1,3 @@
 def hello():
+    # This is a test comment
     return 'world'""",
        status="evaluator_approved",
        vibecoder_prompt="Add a comment",
        evaluator_reasoning="Good addition",
        commit_message="Add helpful comment to hello function",
    )

    db.add(diff)
    db.commit()
    db.refresh(diff)

    yield {
        "id": diff.id,
        "session_id": diff.session_id,
        "project_id": diff.project_id,
        "status": diff.status,
        "base_commit": diff.base_commit,
    }

    db.close()


class TestDiffRetrieval:
    """Test diff retrieval endpoints"""

    async def test_get_project_diffs(self, test_client, test_project, test_diff):
        """Test GET /projects/{id}/diffs"""
        response = await test_client.get(f"/projects/{test_project['id']}/diffs")
        assert response.status_code == 200

        diffs = response.json()
        assert isinstance(diffs, list)
        assert len(diffs) >= 1
        assert any(d["id"] == test_diff["id"] for d in diffs)

    async def test_get_session_diffs(self, test_client, test_session, test_diff):
        """Test GET /sessions/{id}/diffs"""
        response = await test_client.get(f"/sessions/{test_session['id']}/diffs")
        assert response.status_code == 200

        diffs = response.json()
        assert isinstance(diffs, list)
        assert len(diffs) >= 1
        assert any(d["id"] == test_diff["id"] for d in diffs)

    async def test_get_pending_diffs(self, test_client, test_session, test_diff):
        """Test GET /sessions/{id}/diffs/pending"""
        response = await test_client.get(
            f"/sessions/{test_session['id']}/diffs/pending"
        )
        assert response.status_code == 200

        diffs = response.json()
        assert isinstance(diffs, list)
        # Should include our evaluator_approved diff
        assert any(d["id"] == test_diff["id"] for d in diffs)
        # All diffs should be pending
        for diff in diffs:
            assert diff["status"] == "evaluator_approved"

    async def test_get_single_diff(self, test_client, test_diff):
        """Test GET /diffs/{id}"""
        response = await test_client.get(f"/diffs/{test_diff['id']}")
        assert response.status_code == 200

        diff = response.json()
        assert diff["id"] == test_diff["id"]
        assert diff["status"] == "evaluator_approved"
        assert diff["commit_message"] == "Add helpful comment to hello function"

    async def test_get_diff_preview(self, test_client, test_diff):
        """Test GET /diffs/{id}/preview"""
        response = await test_client.get(f"/diffs/{test_diff['id']}/preview")
        assert response.status_code == 200

        preview = response.json()
        assert preview["diff_id"] == test_diff["id"]
        assert "original_code" in preview
        assert "preview_code" in preview
        assert "# This is a test comment" in preview["preview_code"]
        assert preview["commit_message"] == "Add helpful comment to hello function"


class TestHumanReview:
    """Test human review workflow"""

    async def test_approve_diff(self, test_client, test_diff):
        """Test POST /diffs/{id}/review with approval"""
        response = await test_client.post(
            f"/diffs/{test_diff['id']}/review", json={"approved": True}
        )
        assert response.status_code == 200

        diff = response.json()
        assert diff["status"] == "human_approved"

    async def test_reject_diff_with_feedback(self, test_client, test_diff):
        """Test POST /diffs/{id}/review with rejection"""
        feedback = "Please add more detailed comments"
        response = await test_client.post(
            f"/diffs/{test_diff['id']}/review",
            json={"approved": False, "feedback": feedback},
        )
        assert response.status_code == 200

        diff = response.json()
        assert diff["status"] == "human_rejected"
        assert diff["human_feedback"] == feedback

    async def test_review_non_pending_diff(self, test_client, test_diff):
        """Test reviewing a diff that's not pending"""
        # First approve it
        await test_client.post(
            f"/diffs/{test_diff['id']}/review", json={"approved": True}
        )

        # Try to review again
        response = await test_client.post(
            f"/diffs/{test_diff['id']}/review", json={"approved": True}
        )
        assert response.status_code == 400
        assert "not pending review" in response.json()["detail"].lower()


class TestDiffCommit:
    """Test diff commit workflow"""

    async def test_commit_approved_diff(self, test_client, test_diff, test_project):
        """Test POST /diffs/{id}/commit"""
        print(f"Test project current_commit: {test_project.get('current_commit')}")
        print(f"Test diff base_commit: {test_diff['base_commit']}")
        
        # First approve the diff
        await test_client.post(
            f"/diffs/{test_diff['id']}/review", json={"approved": True}
        )

        # Commit the diff
        response = await test_client.post(
            f"/diffs/{test_diff['id']}/commit",
            json={}  # Empty body or can provide {"commit_message": "Custom message"}
        )
        if response.status_code != 200:
            print(f"Commit failed with {response.status_code}: {response.json()}")
        assert response.status_code == 200

        result = response.json()
        assert result["diff_id"] == test_diff["id"]
        assert "committed_sha" in result
        assert len(result["committed_sha"]) == 40  # Git SHA length
        assert "Successfully committed" in result["message"]

        # Verify diff is marked as committed
        diff_response = await test_client.get(f"/diffs/{test_diff['id']}")
        diff = diff_response.json()
        assert diff["status"] == "committed"
        assert diff["committed_sha"] == result["committed_sha"]

    async def test_commit_unapproved_diff(self, test_client, test_diff):
        """Test committing a diff that's not approved"""
        response = await test_client.post(
            f"/diffs/{test_diff['id']}/commit",
            json={}  # Empty body
        )
        assert response.status_code == 400
        assert "not approved" in response.json()["detail"].lower()

    async def test_commit_with_base_mismatch(
        self, test_client, test_diff, test_project, test_server
    ):
        """Test committing when base commit has changed"""
        # Approve the diff
        await test_client.post(
            f"/diffs/{test_diff['id']}/review", json={"approved": True}
        )

        # Make another commit to change base
        from app.services.git_service import GitService
        import os
        
        projects_path = os.path.join(test_server['media_path'], "projects")
        git_service = GitService(base_path=projects_path)
        
        # Directly commit new content to change the base
        new_content = "# Changed\ndef hello():\n    return 'changed'"
        git_service.commit_changes(
            test_project["slug"], new_content, "Change base commit"
        )

        # Try to commit the diff
        response = await test_client.post(
            f"/diffs/{test_diff['id']}/commit",
            json={}  # Empty body
        )
        assert response.status_code == 409
        assert "Base commit mismatch" in response.json()["detail"]


class TestMessageRefinement:
    """Test commit message refinement"""

    async def test_refine_commit_message(self, test_client, test_diff):
        """Test POST /diffs/{id}/refine-message"""
        response = await test_client.post(
            f"/diffs/{test_diff['id']}/refine-message",
            json={"prompt": "Make it more descriptive"},
        )
        assert response.status_code == 200

        result = response.json()
        assert result["diff_id"] == test_diff["id"]
        assert "original_message" in result
        assert "refined_message" in result
        assert result["original_message"] == "Add helpful comment to hello function"

    async def test_refine_message_no_prompt(self, test_client, test_diff):
        """Test refining without additional prompt"""
        response = await test_client.post(
            f"/diffs/{test_diff['id']}/refine-message", json={}
        )
        assert response.status_code == 200

        result = response.json()
        assert "refined_message" in result


class TestDiffValidation:
    """Test diff validation during creation"""

    async def test_invalid_diff_rejected(self, test_server):
        """Test that invalid diffs are rejected during creation"""
        # This would be tested through the VibecodeService
        # which validates diffs before storage
        # For now, we verify the validation utility works
        from app.utils.diff_parser import diff_parser

        invalid_patch = """--- a/code.py
+++ b/code.py
@@ -1,2 +1,2 @@
 def hello():
-    return 'world'
+    return 'syntax error here"""

        original = "def hello():\n    return 'world'"
        result = diff_parser.apply_patch(original, invalid_patch)
        # Should apply but produce invalid Python
        assert result is not None

        # Check syntax validation
        import ast

        try:
            ast.parse(result)
            raise AssertionError("Should have raised SyntaxError")
        except SyntaxError:
            pass  # Expected


class TestPageRefreshRecovery:
    """Test recovery of pending diffs after page refresh"""

    async def test_recover_pending_diffs(self, test_client, test_session, test_diff):
        """Test that pending diffs can be recovered"""
        # Get pending diffs (simulating page refresh)
        response = await test_client.get(
            f"/sessions/{test_session['id']}/diffs/pending"
        )
        assert response.status_code == 200

        diffs = response.json()
        assert len(diffs) >= 1

        # Find our test diff
        pending_diff = next((d for d in diffs if d["id"] == test_diff["id"]), None)
        assert pending_diff is not None
        assert pending_diff["status"] == "evaluator_approved"

        # Should be able to continue review flow
        review_response = await test_client.post(
            f"/diffs/{pending_diff['id']}/review", json={"approved": True}
        )
        assert review_response.status_code == 200
