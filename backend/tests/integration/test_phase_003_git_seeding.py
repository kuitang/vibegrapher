import os
import json
from pathlib import Path

import httpx
import pytest
import pygit2

from app.services.git_service import GitService
from app.management.reset_db import reset_and_seed_database


@pytest.mark.integration
def test_git_service_repository_operations(test_server: dict) -> None:
    """Test GitService creates and manages repositories correctly"""
    with httpx.Client(base_url=test_server["url"]) as client:
        # Create a project
        response = client.post("/projects", json={"name": "Git Test Project"})
        assert response.status_code == 201
        project = response.json()
        
        # Verify repository was created
        repo_path = Path(project["repository_path"])
        assert repo_path.exists()
        assert (repo_path / ".git").exists()
        
        # Get project and verify git fields
        response = client.get(f"/projects/{project['id']}")
        assert response.status_code == 200
        project_data = response.json()
        assert project_data["current_branch"] == "main"
        
        # Delete project
        response = client.delete(f"/projects/{project['id']}")
        assert response.status_code == 204
        
        # Verify repository was deleted
        assert not repo_path.exists()


@pytest.mark.integration
def test_seeded_data_creates_valid_project(test_server: dict) -> None:
    """Test that reset_and_seed creates valid project with git repository"""
    # The test server fixture already runs reset_and_seed_database
    # We just need to verify the seeded data exists
    
    with httpx.Client(base_url=test_server["url"]) as client:
        # List projects - should have seeded project
        response = client.get("/projects")
        assert response.status_code == 200
        projects = response.json()
        assert len(projects) == 1
        
        project = projects[0]
        assert project["name"] == "Agent Triage System"
        assert project["slug"] == "agent-triage-system"
        
        # Verify git repository exists
        repo_path = Path(project["repository_path"])
        assert repo_path.exists()
        assert (repo_path / ".git").exists()
        assert (repo_path / "agents.py").exists()
        
        # Read the agents.py file
        agents_content = (repo_path / "agents.py").read_text()
        assert "TriageAgent" in agents_content
        assert "openai_agents_sdk" in agents_content.lower()
        
        # Verify git history
        repo = pygit2.Repository(str(repo_path))
        assert not repo.is_empty
        
        # Check initial commit
        head = repo.head
        commit = repo.get(head.target)
        assert commit.message == "Initial agent code"
        assert commit.author.name == "Vibegrapher"


@pytest.mark.integration
def test_git_service_commit_operations(test_server: dict) -> None:
    """Test GitService can commit changes correctly"""
    with httpx.Client(base_url=test_server["url"]) as client:
        # Create a project
        response = client.post("/projects", json={"name": "Commit Test"})
        assert response.status_code == 201
        project = response.json()
        slug = project["slug"]
        
        # Use the media path from test fixture
        git_service = GitService(os.path.join(test_server["media_path"], "projects"))
        
        # Make a commit through GitService
        new_code = """# Updated agent code
from openai_agents_sdk import Agent

class UpdatedAgent(Agent):
    def process(self, message: str) -> str:
        return "Updated response"
"""
        
        commit_sha = git_service.commit_changes(
            slug, 
            new_code, 
            "Update agent implementation"
        )
        assert commit_sha is not None
        assert len(commit_sha) == 40  # Git SHA-1 hash length
        
        # Verify the commit
        current_code = git_service.get_current_code(slug)
        assert current_code == new_code
        
        head_commit = git_service.get_head_commit(slug)
        assert head_commit == commit_sha
        
        # Verify through direct git operations
        repo_path = Path(project["repository_path"])
        repo = pygit2.Repository(str(repo_path))
        
        head = repo.head
        commit = repo.get(head.target)
        assert commit.message == "Update agent implementation"
        assert str(commit.id) == commit_sha


@pytest.mark.integration
def test_git_service_error_handling(test_server: dict) -> None:
    """Test GitService handles errors gracefully"""
    # Create GitService with test media path
    git_service = GitService(os.path.join(test_server["media_path"], "projects"))
    
    # Test operations on non-existent project
    assert git_service.get_current_code("nonexistent-project") is None
    assert git_service.get_head_commit("nonexistent-project") is None
    assert git_service.commit_changes(
        "nonexistent-project", 
        "code", 
        "message"
    ) is None
    
    # Verify delete non-existent is safe
    assert git_service.delete_repository("nonexistent-project") == True


@pytest.mark.integration 
def test_seeded_test_cases_execute(test_server: dict) -> None:
    """Test that seeded test cases can be executed"""
    # The test server fixture already runs reset_and_seed_database
    # We just need to verify the seeded test cases exist and can run
    
    with httpx.Client(base_url=test_server["url"], timeout=30.0) as client:
        # Get the seeded project
        response = client.get("/projects")
        assert response.status_code == 200
        projects = response.json()
        project = projects[0]
        
        # Get test cases for the project
        response = client.get(f"/projects/{project['id']}/tests")
        assert response.status_code == 200
        tests = response.json()
        assert len(tests) == 2
        
        # Find the quick test
        quick_test = next(t for t in tests if t["quick_test"])
        assert quick_test["name"] == "Test quick response"
        
        # Run the quick test (should complete within 5 seconds)
        import time
        start_time = time.time()
        
        response = client.post(f"/tests/{quick_test['id']}/run")
        assert response.status_code in [200, 201]
        
        elapsed = time.time() - start_time
        assert elapsed < 10  # Should complete quickly


@pytest.mark.integration
def test_repository_exists_check() -> None:
    """Test repository_exists method works correctly"""
    # Create a GitService instance for testing
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        git_service = GitService(os.path.join(tmpdir, "projects"))
        
        # Create a test repository
        test_slug = "test-repo-exists"
        repo_path = git_service.create_repository(test_slug)
        
        try:
            # Should exist after creation
            assert git_service.repository_exists(test_slug) == True
            
            # Delete and check again
            git_service.delete_repository(test_slug)
            assert git_service.repository_exists(test_slug) == False
            
            # Non-existent should return False
            assert git_service.repository_exists("never-created") == False
        finally:
            # Cleanup if needed
            git_service.delete_repository(test_slug)