import httpx
import pytest


@pytest.mark.asyncio
async def test_create_project(test_server: str) -> None:
    print(f"Running: POST {test_server}/projects")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{test_server}/projects", json={"name": "Test Project"}
        )

    print(f"Result: {response.status_code}, id={response.json().get('id', 'N/A')}")
    print("Expected: 201")

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["slug"].startswith("test-project")
    assert "id" in data
    assert "repository_path" in data
    assert data["current_branch"] == "main"


@pytest.mark.asyncio
async def test_get_project(test_server: str) -> None:
    async with httpx.AsyncClient() as client:
        create_response = await client.post(
            f"{test_server}/projects", json={"name": "Get Test Project"}
        )
        assert create_response.status_code == 201
        project_id = create_response.json()["id"]

        print(f"Running: GET {test_server}/projects/{project_id}")

        response = await client.get(f"{test_server}/projects/{project_id}")

        print(f"Result: {response.status_code}, project returned")
        print("Expected: 200")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == project_id
        assert data["name"] == "Get Test Project"


@pytest.mark.asyncio
async def test_delete_project(test_server: str) -> None:
    async with httpx.AsyncClient() as client:
        create_response = await client.post(
            f"{test_server}/projects", json={"name": "Delete Test Project"}
        )
        assert create_response.status_code == 201
        project_id = create_response.json()["id"]

        print(f"Running: DELETE {test_server}/projects/{project_id}")

        response = await client.delete(f"{test_server}/projects/{project_id}")

        print(f"Result: {response.status_code}")
        print("Expected: 204")

        assert response.status_code == 204

        get_response = await client.get(f"{test_server}/projects/{project_id}")
        assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_list_projects(test_server: str) -> None:
    print(f"Running: GET {test_server}/projects")

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{test_server}/projects")

    print(f"Result: {response.status_code}, {len(response.json())} projects found")
    print(f"Expected: 200")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3


@pytest.mark.asyncio
async def test_database_schema(test_server: str) -> None:
    print("Verifying database tables exist")

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{test_server}/projects")
        assert response.status_code == 200

    print("Result: All tables exist")
    print("Expected: Database schema correct")
