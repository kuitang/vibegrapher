import os
import socket
import sys
import tempfile
import time
from multiprocessing import Process
from pathlib import Path
from typing import Generator

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


def run_test_server(db_path: str, port: int) -> None:
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    from app.main import app

    uvicorn.run(app, host="127.0.0.1", port=port)


@pytest.fixture
def test_server() -> Generator[str, None, None]:
    db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db_path = db_file.name
    db_file.close()

    port = find_free_port()

    reset_and_seed_database(f"sqlite:///{db_path}")

    server_process = Process(target=run_test_server, args=(db_path, port))
    server_process.start()

    server_url = f"http://127.0.0.1:{port}"

    max_retries = 30
    for _ in range(max_retries):
        try:
            response = httpx.get(f"{server_url}/health")
            if response.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(0.5)

    yield server_url

    server_process.terminate()
    server_process.join(timeout=5)
    if server_process.is_alive():
        server_process.kill()

    Path(db_path).unlink()
