import os
import sys
import uuid
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Base, Project, TestCase
from app.services.git_service import GitService

sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def reset_and_seed_database(database_url: str | None = None) -> None:
    url = database_url or settings.database_url

    if "sqlite" in url:
        db_file = url.replace("sqlite:///", "")
        if os.path.exists(db_file):
            os.remove(db_file)
            print(f"Removed existing database: {db_file}")

    engine = create_engine(
        url, connect_args={"check_same_thread": False} if "sqlite" in url else {}
    )

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    session_factory = sessionmaker(bind=engine)
    db = session_factory()

    # Sample agent code based on OpenAI quickstart
    sample_agent_code = '''"""
Agent Triage System - Example OpenAI Agents implementation
Based on OpenAI Agents SDK quickstart
"""

from openai_agents_sdk import Agent, Runner, TriageStrategy


class TriageAgent(Agent):
    """Routes customer inquiries to appropriate department agents"""

    def __init__(self):
        super().__init__(
            name="TriageAgent",
            system_prompt="You are a triage agent that routes inquiries."
        )

    def process(self, message: str) -> str:
        """Process incoming message and route to appropriate agent"""
        # Simple routing logic
        if "billing" in message.lower():
            return "Routing to billing department..."
        elif "technical" in message.lower():
            return "Routing to technical support..."
        else:
            return "Routing to general support..."


def main():
    """Initialize and run the agent"""
    agent = TriageAgent()
    runner = Runner(agent)

    # Example usage
    response = runner.run("I have a technical issue with my account")
    print(response)


if __name__ == "__main__":
    main()
'''

    # Create main project: Agent Triage System
    project_id = str(uuid.uuid4())
    project_slug = "agent-triage-system"

    # Create GitService instance with the proper media path
    # If MEDIA_PATH is set, use it directly (for tests)
    media_path = os.getenv("MEDIA_PATH")
    if media_path:
        git_service = GitService(base_path=os.path.join(media_path, "projects"))
    else:
        git_service = GitService()
    print(f"GitService base_path: {git_service.base_path}")

    # Initialize git repository
    repo_path = git_service.create_repository(project_slug)

    # Commit initial code
    commit_sha = git_service.commit_changes(
        project_slug, sample_agent_code, "Initial agent code"
    )

    # Get the committed code
    current_code = git_service.get_current_code(project_slug)

    # Create project record
    project = Project(
        id=project_id,
        name="Agent Triage System",
        slug=project_slug,
        repository_path=repo_path,
        current_code=current_code,
        current_commit=commit_sha,
        current_branch="main",
    )
    db.add(project)

    # Create test cases for the project
    test1 = TestCase(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name="Test triage routing",
        code="""# Test that agent responds correctly
agent = TriageAgent()
response = agent.process("I have a billing issue")
assert "billing" in response.lower()
""",
        quick_test=False,
    )

    test2 = TestCase(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name="Test quick response",
        code="""# Quick test with 5 second timeout
import time
agent = TriageAgent()
start = time.time()
response = agent.process("technical problem")
elapsed = time.time() - start
assert elapsed < 1.0  # Should respond quickly
assert "technical" in response.lower()
""",
        quick_test=True,
    )

    db.add(test1)
    db.add(test2)

    db.commit()
    db.close()

    print(f"Database reset and seeded successfully at: {url}")
    print("Created project 'Agent Triage System' with git repository")
    print(f"Repository path: {repo_path}")
    print(f"Initial commit: {commit_sha}")
    print(f"MEDIA_PATH env: {os.getenv('MEDIA_PATH')}")
    print("Created 2 test cases (1 regular, 1 quick test)")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Reset and seed database")
    parser.add_argument("--test-db", action="store_true", help="Reset test database")
    args = parser.parse_args()

    if args.test_db:
        reset_and_seed_database(settings.test_database_url)
    else:
        reset_and_seed_database()
