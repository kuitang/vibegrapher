"""Debug test to see what projects are returned"""

import httpx
import pytest


@pytest.mark.asyncio
async def test_debug_projects(test_server):
    """Check what projects are returned from the test server"""
    server_url = test_server["url"]
    print(f"\n\nDEBUG: Test server URL: {server_url}")

    async with httpx.AsyncClient(base_url=server_url, timeout=30.0) as client:
        response = await client.get("/projects")
        print(f"DEBUG: Response status: {response.status_code}")

        if response.status_code == 200:
            projects = response.json()
            print(f"DEBUG: Number of projects: {len(projects)}")
            for p in projects:
                print(f"DEBUG:   - {p['name']} (id: {p['id']})")
        else:
            print(f"DEBUG: Error: {response.text}")

    # This test always passes, it's just for debugging
    assert True
