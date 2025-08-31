"""
Phase 007: Real-Time Message Streaming Tests
Tests OpenAI RunItemStreamEvents integration with database persistence
USES REAL OPENAI API (not mocked)
"""

import os
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.agents.all_agents import vibecode_service
from app.models import ConversationMessage, Project, VibecodeSession
from app.models.base import Base


# Ensure we have OpenAI API key
@pytest.fixture(scope="module")
def check_openai_key():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        pytest.skip("OPENAI_API_KEY not set - skipping OpenAI tests")
    return api_key


@pytest.fixture
def test_db():
    """Create a test database for each test"""
    # Use unique database for each test
    db_name = f"test_streaming_{uuid.uuid4().hex[:8]}.db"
    engine = create_engine(f"sqlite:///{db_name}")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    yield db

    db.close()
    # Cleanup
    Path(db_name).unlink(missing_ok=True)


@pytest.fixture
def test_project(test_db):
    """Create a test project"""
    project = Project(
        id=str(uuid.uuid4()),
        name="Test Streaming Project",
        slug="test-streaming-project",
        current_code="def hello():\n    print('Hello, world!')",
        current_commit="abc123",
        current_branch="main",
    )
    test_db.add(project)
    test_db.commit()
    test_db.refresh(project)
    return project


@pytest.fixture
def test_session(test_db, test_project):
    """Create a test session"""
    session = VibecodeSession(
        id=str(uuid.uuid4()),
        project_id=test_project.id,
        initial_prompt="",
        current_code=test_project.current_code,
    )
    test_db.add(session)
    test_db.commit()
    test_db.refresh(session)
    return session


@pytest.mark.asyncio
async def test_streaming_creates_messages(
    check_openai_key, test_db, test_project, test_session
):
    """Test that streaming creates ConversationMessages for each event"""

    # Test with real OpenAI API
    prompt = "Add a docstring to the hello function"

    result = await vibecode_service.vibecode(
        project_id=test_project.id,
        prompt=prompt,
        current_code=test_project.current_code,
        project_slug=test_project.slug,
        session_id=test_session.id,
        socketio_manager=None,  # No socket.io for this test
    )

    # Verify messages were created
    messages = (
        test_db.query(ConversationMessage).filter_by(session_id=test_session.id).all()
    )

    assert len(messages) > 0, "Should have created messages from stream events"

    # Check that we have different event types
    event_types = {msg.stream_event_type for msg in messages if msg.stream_event_type}
    assert len(event_types) > 0, "Should have different event types"

    # Print event types for debugging
    print(f"Found {len(messages)} messages with event types: {event_types}")


@pytest.mark.asyncio
async def test_sequence_ordering_no_gaps(
    check_openai_key, test_db, test_project, test_session
):
    """Test that stream sequences are ordered correctly with no gaps"""

    prompt = "Add error handling to the hello function"

    result = await vibecode_service.vibecode(
        project_id=test_project.id,
        prompt=prompt,
        current_code=test_project.current_code,
        project_slug=test_project.slug,
        session_id=test_session.id,
        socketio_manager=None,
    )

    # Get all messages ordered by sequence
    messages = (
        test_db.query(ConversationMessage)
        .filter_by(session_id=test_session.id)
        .filter(ConversationMessage.stream_sequence.isnot(None))
        .order_by(ConversationMessage.stream_sequence)
        .all()
    )

    # Extract sequences
    sequences = [msg.stream_sequence for msg in messages]

    # Verify ordering
    assert sequences == sorted(sequences), "Sequences should be in order"

    # Verify no gaps (sequences should be consecutive)
    if len(sequences) > 1:
        for i in range(1, len(sequences)):
            if sequences[i] != sequences[i - 1] + 1:
                pytest.fail(f"Gap detected: {sequences[i-1]} -> {sequences[i]}")

    print(f"✅ Verified {len(sequences)} consecutive sequences with no gaps")


@pytest.mark.asyncio
async def test_tool_call_extraction(
    check_openai_key, test_db, test_project, test_session
):
    """Test that tool calls are properly extracted and stored"""

    # This prompt should trigger a patch submission
    prompt = (
        "Add a parameter 'name' to the hello function and use it in the print statement"
    )

    result = await vibecode_service.vibecode(
        project_id=test_project.id,
        prompt=prompt,
        current_code=test_project.current_code,
        project_slug=test_project.slug,
        session_id=test_session.id,
        socketio_manager=None,
    )

    # Find messages with tool calls
    messages = (
        test_db.query(ConversationMessage)
        .filter_by(session_id=test_session.id)
        .filter(ConversationMessage.tool_calls.isnot(None))
        .all()
    )

    # Should have at least one tool call (submit_patch)
    assert len(messages) > 0, "Should have tool call messages"

    # Verify tool call structure
    for msg in messages:
        assert msg.tool_calls, "Tool calls should not be empty"
        assert isinstance(msg.tool_calls, list), "Tool calls should be a list"

        for tool_call in msg.tool_calls:
            assert "type" in tool_call, "Tool call should have a type"
            print(f"Found tool call: {tool_call.get('type')}")


@pytest.mark.asyncio
async def test_tool_output_extraction(
    check_openai_key, test_db, test_project, test_session
):
    """Test that tool outputs are properly extracted and stored"""

    prompt = "Change the print statement to use f-string formatting"

    result = await vibecode_service.vibecode(
        project_id=test_project.id,
        prompt=prompt,
        current_code=test_project.current_code,
        project_slug=test_project.slug,
        session_id=test_session.id,
        socketio_manager=None,
    )

    # Find messages with tool outputs
    messages = (
        test_db.query(ConversationMessage)
        .filter_by(session_id=test_session.id)
        .filter(ConversationMessage.tool_outputs.isnot(None))
        .all()
    )

    # If we had tool calls, we should have tool outputs
    if messages:
        for msg in messages:
            assert msg.tool_outputs, "Tool outputs should not be empty"
            assert isinstance(msg.tool_outputs, list), "Tool outputs should be a list"

            for tool_output in msg.tool_outputs:
                assert "output" in tool_output or "raw_output" in tool_output
                print(f"Found tool output: {tool_output}")


@pytest.mark.asyncio
async def test_token_usage_extraction(
    check_openai_key, test_db, test_project, test_session
):
    """Test that token usage is properly extracted from stream events"""

    prompt = "Explain what the hello function does"

    result = await vibecode_service.vibecode(
        project_id=test_project.id,
        prompt=prompt,
        current_code=test_project.current_code,
        project_slug=test_project.slug,
        session_id=test_session.id,
        socketio_manager=None,
    )

    # Find messages with token usage
    messages = (
        test_db.query(ConversationMessage)
        .filter_by(session_id=test_session.id)
        .filter(
            (ConversationMessage.usage_input_tokens.isnot(None))
            | (ConversationMessage.usage_output_tokens.isnot(None))
            | (ConversationMessage.usage_total_tokens.isnot(None))
        )
        .all()
    )

    # Should have at least some token usage data
    assert len(messages) > 0, "Should have messages with token usage"

    total_input_tokens = sum(msg.usage_input_tokens or 0 for msg in messages)
    total_output_tokens = sum(msg.usage_output_tokens or 0 for msg in messages)
    total_tokens = sum(msg.usage_total_tokens or 0 for msg in messages)

    print(
        f"Token usage - Input: {total_input_tokens}, Output: {total_output_tokens}, Total: {total_tokens}"
    )

    # Verify we have non-zero token usage
    assert total_tokens > 0, "Should have non-zero token usage"


@pytest.mark.asyncio
async def test_message_content_extraction(
    check_openai_key, test_db, test_project, test_session
):
    """Test that message content is properly extracted from MessageOutputItems"""

    prompt = "What does this function do?"

    result = await vibecode_service.vibecode(
        project_id=test_project.id,
        prompt=prompt,
        current_code=test_project.current_code,
        project_slug=test_project.slug,
        session_id=test_session.id,
        socketio_manager=None,
    )

    # Find messages with content
    messages = (
        test_db.query(ConversationMessage)
        .filter_by(session_id=test_session.id)
        .filter(ConversationMessage.content.isnot(None))
        .all()
    )

    # Should have at least one message with content
    assert len(messages) > 0, "Should have messages with content"

    for msg in messages:
        assert msg.content, "Content should not be empty"
        assert len(msg.content) > 0, "Content should have text"
        print(f"Found content (first 100 chars): {msg.content[:100]}...")


@pytest.mark.asyncio
async def test_all_fields_populated(
    check_openai_key, test_db, test_project, test_session
):
    """Test that all relevant fields are populated in messages"""

    prompt = "Add type hints to the hello function"

    result = await vibecode_service.vibecode(
        project_id=test_project.id,
        prompt=prompt,
        current_code=test_project.current_code,
        project_slug=test_project.slug,
        session_id=test_session.id,
        socketio_manager=None,
    )

    # Get all messages
    messages = (
        test_db.query(ConversationMessage).filter_by(session_id=test_session.id).all()
    )

    # Check various fields are populated
    assert all(msg.id for msg in messages), "All messages should have IDs"
    assert all(
        msg.session_id == test_session.id for msg in messages
    ), "All messages should have correct session ID"
    assert all(msg.role for msg in messages), "All messages should have a role"
    assert all(
        msg.message_type for msg in messages
    ), "All messages should have a message_type"
    assert all(
        msg.created_at for msg in messages
    ), "All messages should have created_at"
    assert all(
        msg.updated_at for msg in messages
    ), "All messages should have updated_at"

    # Count messages with various fields
    with_event_data = sum(1 for msg in messages if msg.event_data)
    with_sequence = sum(1 for msg in messages if msg.stream_sequence is not None)
    with_iteration = sum(1 for msg in messages if msg.iteration is not None)

    print(
        f"""
    Message field statistics:
    - Total messages: {len(messages)}
    - With event_data: {with_event_data}
    - With stream_sequence: {with_sequence}
    - With iteration: {with_iteration}
    """
    )

    # Should have reasonable coverage
    assert with_event_data > 0, "Should have messages with event_data"
    assert with_sequence > 0, "Should have messages with stream_sequence"


@pytest.mark.asyncio
async def test_api_endpoint_returns_all_messages(
    check_openai_key, test_db, test_project, test_session
):
    """Test that the API endpoint returns all messages including stream events"""

    # First, create some messages via vibecode
    prompt = "Add a greeting parameter to the function"

    result = await vibecode_service.vibecode(
        project_id=test_project.id,
        prompt=prompt,
        current_code=test_project.current_code,
        project_slug=test_project.slug,
        session_id=test_session.id,
        socketio_manager=None,
    )

    # Now fetch messages via the database (simulating API endpoint)
    messages = (
        test_db.query(ConversationMessage)
        .filter_by(session_id=test_session.id)
        .order_by(ConversationMessage.created_at)
        .all()
    )

    # Verify we can access all the new fields
    for msg in messages:
        # These should all be accessible without errors
        _ = msg.message_type
        _ = msg.stream_event_type
        _ = msg.stream_sequence
        _ = msg.tool_calls
        _ = msg.tool_outputs
        _ = msg.usage_input_tokens
        _ = msg.usage_output_tokens
        _ = msg.usage_total_tokens

    print(
        f"✅ Successfully fetched {len(messages)} messages with all fields accessible"
    )

    # Group messages by type
    by_type = {}
    for msg in messages:
        msg_type = msg.message_type or "unknown"
        by_type[msg_type] = by_type.get(msg_type, 0) + 1

    print(f"Messages by type: {by_type}")


if __name__ == "__main__":
    # Run tests with real OpenAI API
    pytest.main([__file__, "-v", "-s"])
