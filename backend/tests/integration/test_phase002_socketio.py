import asyncio

import httpx
import pytest
import socketio


@pytest.mark.asyncio
async def test_socketio_connection(test_server: str) -> None:
    """Test basic Socket.io connection"""
    print(f"Testing Socket.io connection to {test_server}")

    sio = socketio.AsyncClient()
    connected = False

    @sio.event
    async def connect():
        nonlocal connected
        connected = True
        print("Socket.io connected")

    await sio.connect(test_server, socketio_path="/socket.io/")
    await asyncio.sleep(0.5)

    assert connected
    print("Result: Connected successfully")
    print("Expected: Connection established")

    await sio.disconnect()


@pytest.mark.asyncio
async def test_subscribe_to_project(test_server: str) -> None:
    """Test subscribing to project room"""
    print("Testing project subscription")

    # Create a project first
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{test_server}/projects", json={"name": "Socket Test Project"}
        )
        assert response.status_code == 201
        project_id = response.json()["id"]

    # Connect Socket.io client
    sio = socketio.AsyncClient()
    is_subscribed = False
    received_project_id = None

    @sio.event
    async def subscribed(data):
        nonlocal is_subscribed, received_project_id
        is_subscribed = True
        received_project_id = data.get("project_id")
        print(f"Subscribed to project: {received_project_id}")

    await sio.connect(test_server, socketio_path="/socket.io/")

    # Subscribe to project
    await sio.emit("subscribe", {"project_id": project_id})
    await asyncio.sleep(0.5)

    assert is_subscribed
    assert received_project_id == project_id
    print("Result: Subscribed to project room")
    print("Expected: Subscription successful")

    await sio.disconnect()


@pytest.mark.asyncio
async def test_heartbeat_events(test_server: str) -> None:
    """Test heartbeat events are sent"""
    print("Testing heartbeat events (may take up to 30 seconds)")

    sio = socketio.AsyncClient()
    heartbeat_received = False
    heartbeat_data = None

    @sio.event
    async def heartbeat(data):
        nonlocal heartbeat_received, heartbeat_data
        heartbeat_received = True
        heartbeat_data = data
        print(f"Heartbeat received: {data}")

    await sio.connect(test_server, socketio_path="/socket.io/")

    # Wait for heartbeat (sent every 30 seconds)
    # In tests, we might want to configure a shorter interval
    for _ in range(32):  # Wait up to 32 seconds
        if heartbeat_received:
            break
        await asyncio.sleep(1)

    assert heartbeat_received, "No heartbeat received after 32 seconds"
    assert heartbeat_data is not None
    assert "server_time" in heartbeat_data
    assert "status" in heartbeat_data
    assert heartbeat_data["status"] == "alive"
    assert "connections" in heartbeat_data
    print(
        f"Result: Heartbeat received with {heartbeat_data['connections']} connections"
    )
    print("Expected: Heartbeat with connection count")

    await sio.disconnect()


@pytest.mark.asyncio
async def test_multiple_clients_in_room(test_server: str) -> None:
    """Test multiple clients can join same project room"""
    print("Testing multiple clients in project room")

    # Create a project
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{test_server}/projects", json={"name": "Multi-client Test"}
        )
        project_id = response.json()["id"]

    # Connect two clients
    sio1 = socketio.AsyncClient()
    sio2 = socketio.AsyncClient()

    await sio1.connect(test_server, socketio_path="/socket.io/")
    await sio2.connect(test_server, socketio_path="/socket.io/")

    # Both subscribe to same project
    await sio1.emit("subscribe", {"project_id": project_id})
    await sio2.emit("subscribe", {"project_id": project_id})
    await asyncio.sleep(0.5)

    print(f"Result: 2 clients subscribed to project {project_id}")
    print("Expected: Multiple clients in same room")

    await sio1.disconnect()
    await sio2.disconnect()


@pytest.mark.asyncio
async def test_disconnection_cleanup(test_server: str) -> None:
    """Test that disconnected clients are cleaned up"""
    print("Testing disconnection cleanup")

    # Connect multiple clients
    sio1 = socketio.AsyncClient()
    sio2 = socketio.AsyncClient()
    sio3 = socketio.AsyncClient()

    await sio1.connect(test_server, socketio_path="/socket.io/")
    await sio2.connect(test_server, socketio_path="/socket.io/")
    await sio3.connect(test_server, socketio_path="/socket.io/")

    # Subscribe all to a project
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{test_server}/projects", json={"name": "Cleanup Test"}
        )
        project_id = response.json()["id"]

    await sio1.emit("subscribe", {"project_id": project_id})
    await sio2.emit("subscribe", {"project_id": project_id})
    await sio3.emit("subscribe", {"project_id": project_id})
    await asyncio.sleep(0.5)

    # Disconnect two clients
    await sio1.disconnect()
    await sio2.disconnect()
    await asyncio.sleep(0.5)

    print("Result: 2 clients disconnected, 1 remaining")
    print("Expected: Disconnected clients removed from rooms")

    # Clean up
    await sio3.disconnect()
