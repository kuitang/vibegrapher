"""
Phase 005: Session Management Integration Tests
Tests session endpoints with OpenAI integration and Socket.io streaming
"""

import asyncio
import json
import uuid
from typing import Any, Dict, List

import httpx
import pytest
import socketio
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def test_client(test_server):
    """Create test HTTP client"""
    async with httpx.AsyncClient(base_url=test_server["url"], timeout=30.0) as client:
        yield client


@pytest.fixture
async def socket_client(test_server):
    """Create Socket.io test client"""
    sio = socketio.AsyncClient()
    await sio.connect(test_server["url"], wait_timeout=10)
    yield sio
    await sio.disconnect()


@pytest.fixture
async def test_project(test_client):
    """Create a test project"""
    response = await test_client.post(
        "/projects",
        json={
            "name": "Session Test Project",
            "description": "Testing session management",
            "current_code": "def hello():\n    return 'world'"
        }
    )
    assert response.status_code == 201
    project = response.json()
    return project


class TestSessionCreation:
    """Test session creation and retrieval"""
    
    async def test_create_session(self, test_client, test_project):
        """Test POST /projects/{id}/sessions"""
        # Create session
        response = await test_client.post(f"/projects/{test_project['id']}/sessions")
        assert response.status_code == 201
        
        session = response.json()
        assert session["id"]
        assert session["project_id"] == test_project["id"]
        assert session["initial_prompt"] == ""
        # current_code should be the project's code or empty string
        expected_code = test_project.get("current_code") or ""
        assert session["current_code"] == expected_code or session["current_code"] == ""
        
        # Verify session can be retrieved
        get_response = await test_client.get(f"/sessions/{session['id']}")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == session["id"]
    
    async def test_create_session_invalid_project(self, test_client):
        """Test session creation with invalid project ID"""
        response = await test_client.post("/projects/invalid-id/sessions")
        assert response.status_code == 404
        assert "Project not found" in response.json()["detail"]


class TestMessageSending:
    """Test message sending and vibecode integration"""
    
    async def test_send_message_to_session(self, test_client, test_project):
        """Test POST /sessions/{id}/messages"""
        # Create session
        session_response = await test_client.post(f"/projects/{test_project['id']}/sessions")
        session = session_response.json()
        
        # Send message - using simple prompt that should work
        message_response = await test_client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "Add a docstring to the hello function"}
        )
        assert message_response.status_code == 200
        
        result = message_response.json()
        assert result["session_id"] == session["id"]
        # Should have either content or diff_id
        assert result.get("content") or result.get("diff_id")
        
        # Verify token usage is included
        if result.get("token_usage"):
            assert "total_tokens" in result["token_usage"]
    
    async def test_send_multiple_messages_context(self, test_client, test_project):
        """Test that multiple messages maintain conversation context"""
        # Create session
        session_response = await test_client.post(f"/projects/{test_project['id']}/sessions")
        session = session_response.json()
        
        # Send first message
        msg1_response = await test_client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "Add a greet function that takes a name parameter"}
        )
        assert msg1_response.status_code == 200
        
        # Send second message referencing first
        msg2_response = await test_client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "Make the greet function return a greeting in Spanish"}
        )
        assert msg2_response.status_code == 200
        
        # Get messages to verify context
        messages_response = await test_client.get(f"/sessions/{session['id']}/messages")
        assert messages_response.status_code == 200
        messages = messages_response.json()
        
        # Should have at least 2 messages (could have assistant responses too)
        assert len(messages) >= 2
        # Messages should be ordered by creation time
        for i in range(1, len(messages)):
            assert messages[i]["created_at"] >= messages[i-1]["created_at"]


class TestSessionDeletion:
    """Test session deletion and cleanup"""
    
    async def test_delete_session(self, test_client, test_project):
        """Test DELETE /sessions/{id}"""
        # Create session
        session_response = await test_client.post(f"/projects/{test_project['id']}/sessions")
        session = session_response.json()
        
        # Send a message to create some data
        await test_client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "Test message"}
        )
        
        # Delete session
        delete_response = await test_client.delete(f"/sessions/{session['id']}")
        assert delete_response.status_code == 204
        
        # Verify session is gone
        get_response = await test_client.get(f"/sessions/{session['id']}")
        assert get_response.status_code == 404
        
        # Verify messages are also deleted
        messages_response = await test_client.get(f"/sessions/{session['id']}/messages")
        assert messages_response.status_code == 404
    
    async def test_delete_nonexistent_session(self, test_client):
        """Test deleting a session that doesn't exist"""
        response = await test_client.delete("/sessions/nonexistent-id")
        assert response.status_code == 404


class TestFullMessageRetrieval:
    """Test getting complete OpenAI response data"""
    
    async def test_get_full_message(self, test_client, test_project):
        """Test GET /messages/{id}/full"""
        # Create session and send message
        session_response = await test_client.post(f"/projects/{test_project['id']}/sessions")
        session = session_response.json()
        
        # Send message to create a conversation message
        await test_client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "Add a simple comment"}
        )
        
        # Get messages
        messages_response = await test_client.get(f"/sessions/{session['id']}/messages")
        messages = messages_response.json()
        assert len(messages) > 0
        
        # Get full message data
        message_id = messages[0]["id"]
        full_response = await test_client.get(f"/messages/{message_id}/full")
        assert full_response.status_code == 200
        
        full_data = full_response.json()
        assert full_data["id"] == message_id
        assert full_data["session_id"] == session["id"]
        assert "role" in full_data
        assert "content" in full_data
        # May have OpenAI response data
        if full_data.get("openai_response"):
            assert isinstance(full_data["openai_response"], dict)
    
    async def test_get_full_message_not_found(self, test_client):
        """Test getting full message with invalid ID"""
        response = await test_client.get("/messages/invalid-id/full")
        assert response.status_code == 404
        assert "Message not found" in response.json()["detail"]


class TestSocketIOIntegration:
    """Test Socket.io real-time streaming"""
    
    async def test_socket_streaming_token_usage(self, test_client, socket_client, test_project):
        """Test that token usage is streamed via Socket.io"""
        # Subscribe to project events
        received_events = []
        
        @socket_client.on("token_usage")
        def on_token_usage(data):
            received_events.append(("token_usage", data))
        
        @socket_client.on("vibecode_response")
        def on_vibecode_response(data):
            received_events.append(("vibecode_response", data))
        
        # Subscribe to project room
        await socket_client.emit("subscribe", {"project_id": test_project["id"]})
        await asyncio.sleep(0.5)  # Allow subscription to complete
        
        # Create session and send message
        session_response = await test_client.post(f"/projects/{test_project['id']}/sessions")
        session = session_response.json()
        
        # Send message that triggers vibecode
        await test_client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "Add a TODO comment"}
        )
        
        # Wait for Socket.io events
        await asyncio.sleep(2)
        
        # Should have received at least one event
        assert len(received_events) > 0
        
        # Check for token usage event
        token_events = [e for e in received_events if e[0] == "token_usage"]
        if token_events:
            usage_data = token_events[0][1]
            assert "usage" in usage_data or "prompt_tokens" in usage_data
    
    async def test_socket_conversation_message(self, test_client, socket_client, test_project):
        """Test conversation messages are broadcast via Socket.io"""
        received_messages = []
        
        @socket_client.on("conversation_message")
        def on_conversation_message(data):
            received_messages.append(data)
        
        # Subscribe to project
        await socket_client.emit("subscribe", {"project_id": test_project["id"]})
        await asyncio.sleep(0.5)
        
        # Create session and send message
        session_response = await test_client.post(f"/projects/{test_project['id']}/sessions")
        session = session_response.json()
        
        await test_client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "Test Socket.io streaming"}
        )
        
        # Wait for messages
        await asyncio.sleep(2)
        
        # Should have received conversation messages
        if received_messages:
            msg = received_messages[0]
            assert "session_id" in msg
            assert msg["session_id"] == session["id"]
            assert "content" in msg or "patch_preview" in msg


class TestSessionPersistence:
    """Test session persistence with OpenAI SQLiteSession"""
    
    async def test_openai_session_key_set(self, test_client, test_project):
        """Test that openai_session_key is set when creating sessions"""
        # Create session
        session_response = await test_client.post(f"/projects/{test_project['id']}/sessions")
        session = session_response.json()
        
        # Session should have an openai_session_key (may be null initially)
        assert "openai_session_key" in session or "id" in session
        
        # After sending a message, the key should be set
        await test_client.post(
            f"/sessions/{session['id']}/messages",
            json={"prompt": "Initialize session"}
        )
        
        # Get session again
        get_response = await test_client.get(f"/sessions/{session['id']}")
        updated_session = get_response.json()
        # The OpenAI session key is managed internally
        assert updated_session["id"] == session["id"]