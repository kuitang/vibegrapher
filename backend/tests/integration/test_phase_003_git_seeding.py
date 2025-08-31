import os
from pathlib import Path

import httpx
import pygit2
import pytest
from app.services.git_service import GitService


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
        assert project_data["current_branch"] in [
            "main",
            "master",
        ]  # Git default branch

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
            slug, new_code, "Update agent implementation"
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
    assert git_service.commit_changes("nonexistent-project", "code", "message") is None

    # Verify delete non-existent is safe
    assert git_service.delete_repository("nonexistent-project") is True


# NOTE: test_seeded_test_cases_execute was deleted because the /tests/{id}/run endpoints
# were removed. These were mock endpoints that didn't actually execute tests - they always
# returned fake success responses. Real test execution was never implemented.


@pytest.mark.integration
def test_repository_exists_check() -> None:
    """Test repository_exists method works correctly"""
    # Create a GitService instance for testing
    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        git_service = GitService(os.path.join(tmpdir, "projects"))

        # Create a test repository
        test_slug = "test-repo-exists"
        git_service.create_repository(test_slug)

        try:
            # Should exist after creation
            assert git_service.repository_exists(test_slug) is True

            # Delete and check again
            git_service.delete_repository(test_slug)
            assert git_service.repository_exists(test_slug) is False

            # Non-existent should return False
            assert git_service.repository_exists("never-created") is False
        finally:
            # Cleanup if needed
            git_service.delete_repository(test_slug)


@pytest.mark.integration
def test_new_project_has_initial_commit_and_head(test_server: dict) -> None:
    """Test that newly created projects have an initial commit and HEAD is properly set"""
    with httpx.Client(base_url=test_server["url"]) as client:
        # Create a new project
        response = client.post("/projects", json={"name": "Test Initial Commit"})
        assert response.status_code == 201
        project = response.json()

        # Verify the response contains expected fields
        assert project["name"] == "Test Initial Commit"
        assert project["slug"] is not None
        assert project["repository_path"] is not None
        assert project["current_branch"] in ["main", "master"]  # Git default branch
        assert project["current_commit"] is not None  # Should have initial commit
        assert project["current_code"] is not None  # Should have initial code

        # Verify the git repository state
        repo_path = Path(project["repository_path"])
        assert repo_path.exists()
        assert (repo_path / ".git").exists()

        # Check that main.py was created
        main_py = repo_path / "main.py"
        assert main_py.exists()
        content = main_py.read_text()
        assert "Welcome to Vibegrapher" in content
        assert f"Project: {project['name']}" in content
        assert "def main():" in content

        # Open the repository with pygit2 and verify HEAD
        repo = pygit2.Repository(str(repo_path))
        assert not repo.is_empty, "Repository should not be empty"
        assert repo.head is not None, "HEAD should be set"

        # Get HEAD commit
        head = repo.head
        assert head.target is not None, "HEAD should point to a commit"
        commit = repo.get(head.target)

        # Verify commit details
        assert commit is not None
        assert commit.message == "Initial project setup"
        assert commit.author.name == "Vibegrapher"
        assert commit.author.email == "vibegrapher@example.com"

        # Verify the commit SHA matches what's in the database
        assert str(commit.id) == project["current_commit"]

        # Test that we can retrieve the project and it still has HEAD
        response = client.get(f"/projects/{project['id']}")
        assert response.status_code == 200
        updated_project = response.json()
        assert updated_project["current_commit"] is not None
        assert updated_project["current_code"] is not None
        assert updated_project["current_branch"] in [
            "main",
            "master",
        ]  # Git default branch

        # Clean up
        response = client.delete(f"/projects/{project['id']}")
        assert response.status_code == 204
