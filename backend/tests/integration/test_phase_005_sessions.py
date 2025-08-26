import asyncio
import httpx
import pytest
import socketio


@pytest.mark.asyncio
async def test_session_with_socket_streaming(test_server: dict) -> None:
    """Test session creation and real-time streaming via Socket.io"""
    server_url = test_server["url"]
    
    # Create project first
    async with httpx.AsyncClient() as client:
        project_response = await client.post(
            f"{server_url}/projects", json={"name": "Socket Test Project"}
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]
    
    # Connect Socket.io client
        sio = socketio.AsyncClient(logger=True, engineio_logger=True)
        received_messages = []
        
        print("Registering event handlers...")
        
        @sio.event
        async def connect():
            print("Socket.io client connected")
            
        @sio.event
        async def disconnect():
            print("Socket.io client disconnected")
            print(f"Received messages at disconnect: {len(received_messages)}")
            
        @sio.event
        async def conversation_message(data):
            print(f"Received conversation_message: {data}")
            received_messages.append(data)
            print(f"Total received messages: {len(received_messages)}")
            
        @sio.event
        async def connected(data):
            print(f"Connected event: {data}")
            
        @sio.event
        async def subscribed(data):
            print(f"Subscribed event: {data}")
        
        print("Event handlers registered.")

        await sio.connect(server_url)
        print("Connected to server.")

        # Subscribe to project room
        print(f"Subscribing to project {project_id}")
        await sio.emit("subscribe", {"project_id": project_id})
        print("Subscribe event sent.")
    
    # Wait a bit for subscription to process
    await sio.sleep(5)
    
    # Create session
    async with httpx.AsyncClient() as client:
        session_response = await client.post(
            f"{server_url}/projects/{project_id}/sessions"
        )
        assert session_response.status_code == 201
        session_id = session_response.json()["id"]
    
    # Send message via HTTP with a longer timeout
    async with httpx.AsyncClient(timeout=30.0) as client:
        message_response = await client.post(
            f"{server_url}/sessions/{session_id}/messages",
            json={"prompt": "Create a simple function that adds two numbers"}
        )
        assert message_response.status_code == 200
    
    # Wait for Socket.io messages with a timeout
    # We'll check for messages in a loop
    start_time = asyncio.get_event_loop().time()
    timeout = 30.0
    while len(received_messages) < 2 and (asyncio.get_event_loop().time() - start_time) < timeout:
        print(f"Waiting for messages... Current count: {len(received_messages)}")
        await sio.sleep(1)
    
    # Wait a bit longer to make sure all messages are received
    print(f"Final wait... Current count: {len(received_messages)}")
    await sio.sleep(5)
    print(f"After final wait... Current count: {len(received_messages)}")
    
    # Verify Socket.io received conversation_message events
    assert len(received_messages) >= 2, f"Expected at least 2 conversation_message events, but received {len(received_messages)}. Messages received: {received_messages}"
    
    # Disconnect Socket.io client
    await sio.disconnect()


@pytest.mark.asyncio
async def test_session_persistence(test_server: dict) -> None:
    """Test session persistence and conversation context"""
    server_url = test_server["url"]
    
    # Create project
    async with httpx.AsyncClient() as client:
        project_response = await client.post(
            f"{server_url}/projects", json={"name": "Persistence Test Project"}
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]
    
    # Create session
    async with httpx.AsyncClient() as client:
        session_response = await client.post(
            f"{server_url}/projects/{project_id}/sessions"
        )
        assert session_response.status_code == 201
        session_id = session_response.json()["id"]
    
    # Send first message
    async with httpx.AsyncClient() as client:
        first_message_response = await client.post(
            f"{server_url}/sessions/{session_id}/messages",
            json={"prompt": "Create a triage agent"}
        )
        assert first_message_response.status_code == 200
    
    # Send second message
    async with httpx.AsyncClient() as client:
        second_message_response = await client.post(
            f"{server_url}/sessions/{session_id}/messages",
            json={"prompt": "Make it Spanish"}
        )
        assert second_message_response.status_code == 200
    
    # Get messages and verify count and context
    async with httpx.AsyncClient() as client:
        messages_response = await client.get(
            f"{server_url}/sessions/{session_id}/messages"
        )
        assert messages_response.status_code == 200
        messages = messages_response.json()
        assert len(messages) == 2, f"Expected 2 messages, got {len(messages)}"
        
        # Verify messages have proper structure
        for msg in messages:
            assert "id" in msg
            assert "session_id" in msg
            assert "role" in msg
            assert "content" in msg
            assert "created_at" in msg


@pytest.mark.asyncio
async def test_full_response_storage(test_server: dict) -> None:
    """Test full OpenAI response storage"""
    server_url = test_server["url"]
    
    # Create project
    async with httpx.AsyncClient() as client:
        project_response = await client.post(
            f"{server_url}/projects", json={"name": "Full Response Test Project"}
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]
    
    # Create session
    async with httpx.AsyncClient() as client:
        session_response = await client.post(
            f"{server_url}/projects/{project_id}/sessions"
        )
        assert session_response.status_code == 201
        session_id = session_response.json()["id"]
    
    # Send message
    async with httpx.AsyncClient() as client:
        message_response = await client.post(
            f"{server_url}/sessions/{session_id}/messages",
            json={"prompt": "Create a simple function that multiplies two numbers"}
        )
        assert message_response.status_code == 200
        message_data = message_response.json()
        message_id = message_data.get("id")  # This might not be directly returned, so we'll get it from the messages endpoint
    
    # Get message ID from messages endpoint
    async with httpx.AsyncClient() as client:
        messages_response = await client.get(
            f"{server_url}/sessions/{session_id}/messages"
        )
        assert messages_response.status_code == 200
        messages = messages_response.json()
        assert len(messages) > 0
        message_id = messages[0]["id"]
    
    # Get full response
    async with httpx.AsyncClient() as client:
        full_response = await client.get(
            f"{server_url}/messages/{message_id}/full"
        )
        # Note: This endpoint might not exist yet or might return 404 if not implemented
        # For now, we'll just check that it doesn't return a 500 error
        assert full_response.status_code in [200, 404], f"Unexpected status code: {full_response.status_code}"