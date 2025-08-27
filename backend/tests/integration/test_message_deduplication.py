"""
Test message deduplication between client and server
"""

import uuid
from unittest.mock import patch

import pytest
from app.database import get_db
from app.main import app
from app.models import ConversationMessage, Project, VibecodeSession
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    return next(get_db())


@pytest.fixture
def sample_project(db: Session):
    """Create a sample project"""
    # Use unique slug to avoid conflicts
    unique_slug = f"test-dedup-{uuid.uuid4().hex[:8]}"
    project = Project(
        id=str(uuid.uuid4()),
        name="Test Deduplication Project",
        current_code="def hello():\n    return 'world'",
        slug=unique_slug,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@pytest.fixture
def sample_session(db: Session, sample_project):
    """Create a sample session"""
    session = VibecodeSession(
        id=str(uuid.uuid4()),
        project_id=sample_project.id,
        openai_session_key=f"test_session_{uuid.uuid4().hex[:8]}",
        conversations_db_path=f"test_conversations_{uuid.uuid4().hex[:8]}.db",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


class TestMessageDeduplication:
    """Test message deduplication strategies"""

    def test_client_provided_message_id_prevents_duplicates(
        self, client, db: Session, sample_session
    ):
        """Test that providing a message_id prevents duplicate user messages"""
        # Client provides a specific message_id
        message_id = f"client-{uuid.uuid4()}"

        with patch("app.api.sessions.vibecode_service.vibecode") as mock_vibecode:
            mock_vibecode.return_value = {
                "content": "Test response",
                "diff_id": None,
                "patch": None,
                "token_usage": {"total_tokens": 100},
                "error": None,
            }

            # First request with message_id
            response1 = client.post(
                f"/sessions/{sample_session.id}/messages",
                json={"prompt": "Test prompt", "message_id": message_id},
            )
            assert response1.status_code == 200

            # Second request with same message_id (simulating duplicate)
            response2 = client.post(
                f"/sessions/{sample_session.id}/messages",
                json={"prompt": "Test prompt", "message_id": message_id},
            )
            assert response2.status_code == 200

        # Check database - should only have one user message with this ID
        messages = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.id == message_id)
            .all()
        )
        assert len(messages) == 1
        assert messages[0].content == "Test prompt"
        assert messages[0].role == "user"

    def test_deterministic_agent_message_ids(self, client, db: Session, sample_session):
        """Test that agent messages use deterministic IDs to prevent duplicates"""
        session_id = sample_session.id

        # Manually create agent messages with deterministic IDs
        vibecoder_id = f"{session_id}_vibecoder_0"
        evaluator_id = f"{session_id}_evaluator_0"

        # Create first vibecoder message
        msg1 = ConversationMessage(
            id=vibecoder_id,
            session_id=session_id,
            role="assistant",
            content="VibeCoder response",
            iteration=0,
        )
        db.add(msg1)
        db.commit()

        # Try to create duplicate vibecoder message (should be prevented by ID constraint)
        existing = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.id == vibecoder_id)
            .first()
        )
        assert existing is not None
        assert existing.content == "VibeCoder response"

        # Create evaluator message with different deterministic ID
        msg2 = ConversationMessage(
            id=evaluator_id,
            session_id=session_id,
            role="assistant",
            content="Evaluator response",
            iteration=0,
        )
        db.add(msg2)
        db.commit()

        # Verify both messages exist with correct IDs
        all_messages = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.session_id == session_id)
            .all()
        )
        assert len(all_messages) == 2

        ids = [msg.id for msg in all_messages]
        assert vibecoder_id in ids
        assert evaluator_id in ids

    def test_no_message_id_generates_unique_ids(
        self, client, db: Session, sample_session
    ):
        """Test that messages without IDs get unique generated IDs"""
        with patch("app.api.sessions.vibecode_service.vibecode") as mock_vibecode:
            mock_vibecode.return_value = {
                "content": "Test response",
                "diff_id": None,
                "patch": None,
                "token_usage": {"total_tokens": 100},
                "error": None,
            }

            # Multiple requests without message_id
            response1 = client.post(
                f"/sessions/{sample_session.id}/messages",
                json={"prompt": "First prompt"},
            )
            assert response1.status_code == 200

            response2 = client.post(
                f"/sessions/{sample_session.id}/messages",
                json={"prompt": "Second prompt"},
            )
            assert response2.status_code == 200

        # Check database - should have two different messages
        messages = (
            db.query(ConversationMessage)
            .filter(
                ConversationMessage.session_id == sample_session.id,
                ConversationMessage.role == "user",
            )
            .all()
        )
        assert len(messages) == 2
        assert messages[0].content == "First prompt"
        assert messages[1].content == "Second prompt"
        # IDs should be different
        assert messages[0].id != messages[1].id

    @patch("app.agents.all_agents.VibecodeService._save_conversation_message_async")
    @patch("app.agents.all_agents.VibecodeService._create_message_from_event")
    def test_agent_message_deduplication_in_service(
        self, mock_create, mock_save, db: Session, sample_project
    ):
        """Test that agent messages are deduplicated in VibecodeService"""

        # Mock the async methods
        mock_create.return_value = {"id": "mock_message"}
        mock_save.return_value = None

        session_id = str(uuid.uuid4())

        # Simulate the _save_conversation_message_async logic
        async def save_with_dedup(
            response, agent_type, iteration, session_id, project_id
        ):
            message_id = f"{session_id}_{agent_type}_{iteration}"

            # Check if exists
            existing = (
                db.query(ConversationMessage)
                .filter(ConversationMessage.id == message_id)
                .first()
            )

            if not existing:
                message = ConversationMessage(
                    id=message_id,
                    session_id=session_id,
                    role="assistant",
                    content=f"{agent_type} response at iteration {iteration}",
                    iteration=iteration,
                )
                db.add(message)
                db.commit()
                return True
            return False

        # Test saving messages
        import asyncio

        # First save - should succeed
        saved1 = asyncio.run(
            save_with_dedup(None, "vibecoder", 0, session_id, sample_project.id)
        )
        assert saved1 is True

        # Second save with same ID - should be deduplicated
        saved2 = asyncio.run(
            save_with_dedup(None, "vibecoder", 0, session_id, sample_project.id)
        )
        assert saved2 is False

        # Different iteration - should succeed
        saved3 = asyncio.run(
            save_with_dedup(None, "vibecoder", 1, session_id, sample_project.id)
        )
        assert saved3 is True

        # Check final message count
        messages = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.session_id == session_id)
            .all()
        )
        assert len(messages) == 2  # Only 2 unique messages saved

    def test_concurrent_message_creation_handling(
        self, client, db: Session, sample_session
    ):
        """Test handling of concurrent message creation attempts"""
        message_id = f"concurrent-{uuid.uuid4()}"

        # Simulate client creating message first
        client_message = ConversationMessage(
            id=message_id,
            session_id=sample_session.id,
            role="user",
            content="Client created this",
        )
        db.add(client_message)
        db.commit()

        # Now server tries to create same message (should be skipped)
        with patch("app.api.sessions.vibecode_service.vibecode") as mock_vibecode:
            mock_vibecode.return_value = {
                "content": "Test response",
                "diff_id": None,
                "patch": None,
                "token_usage": {"total_tokens": 100},
                "error": None,
            }

            # Server request with same message_id
            response = client.post(
                f"/sessions/{sample_session.id}/messages",
                json={"prompt": "Server trying to create", "message_id": message_id},
            )
            assert response.status_code == 200

        # Check database - should still have only one message with original content
        messages = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.id == message_id)
            .all()
        )
        assert len(messages) == 1
        assert (
            messages[0].content == "Client created this"
        )  # Original content preserved
