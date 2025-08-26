import os
import socket
import sys
import time
from collections.abc import Generator
from multiprocessing import Process
from pathlib import Path

import httpx
import pytest
import uvicorn
from app.management.reset_db import reset_and_seed_database

sys.path.insert(0, str(Path(__file__).parent.parent))


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port


def run_test_server(db_path: str, port: int, media_path: str) -> None:
    # Set isolated environment variables BEFORE any imports
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["MEDIA_PATH"] = media_path
    os.environ["PORT"] = str(port)

    # Force reimport of modules to ensure they pick up the new env vars
    if "app.config" in sys.modules:
        del sys.modules["app.config"]
    if "app.database" in sys.modules:
        del sys.modules["app.database"]
    if "app.services.git_service" in sys.modules:
        del sys.modules["app.services.git_service"]
    if "app.main" in sys.modules:
        del sys.modules["app.main"]

    # Import app AFTER setting env vars to ensure isolation
    from app.main import app

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="error")


@pytest.fixture
def test_server() -> Generator[dict, None, None]:
    # Create temp database in /tmp with unique name
    import uuid

    test_id = str(uuid.uuid4())[:8]
    db_path = f"/tmp/test_vibegrapher_{test_id}.db"
    media_path = f"/tmp/test_media_{test_id}"

    # Create media directory
    Path(media_path).mkdir(parents=True, exist_ok=True)

    # Get a random available port
    port = find_free_port()

    print("Starting isolated test server:")
    print(f"  Database: {db_path}")
    print(f"  Port: {port}")
    print(f"  Media: {media_path}")

    # Set env vars for the reset_and_seed function
    os.environ["MEDIA_PATH"] = media_path

    # Reset and seed the test database
    reset_and_seed_database(f"sqlite:///{db_path}")

    # Start server in separate process for complete isolation
    server_process = Process(target=run_test_server, args=(db_path, port, media_path))
    server_process.start()

    server_url = f"http://127.0.0.1:{port}"

    # Wait for server to be ready
    max_retries = 30
    for i in range(max_retries):
        try:
            response = httpx.get(f"{server_url}/health", timeout=1.0)
            if response.status_code == 200:
                print(f"Test server ready at {server_url}")
                break
        except Exception:
            if i == max_retries - 1:
                server_process.terminate()
                raise RuntimeError(
                    f"Test server failed to start on port {port}"
                ) from None
        time.sleep(0.5)

    yield {"url": server_url, "media_path": media_path, "test_id": test_id}

    # Cleanup
    print("Cleaning up test server...")
    server_process.terminate()
    server_process.join(timeout=5)
    if server_process.is_alive():
        server_process.kill()
        server_process.join()

    # Remove temp files
    if Path(db_path).exists():
        Path(db_path).unlink()
    if Path(media_path).exists():
        import shutil

        shutil.rmtree(media_path)
