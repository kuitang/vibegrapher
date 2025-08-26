#!/usr/bin/env python3
"""Debug test to see what projects are returned"""

import asyncio
import sys

import httpx
from tests.conftest import test_server


async def debug_test():
    """Check what projects are returned from the test server"""
    # Start a test server
    server = None
    for item in test_server():
        server = item
        break

    if not server:
        print("Failed to start test server")
        sys.exit(1)

    print(f"Test server started at: {server['url']}")

    # Fetch projects
    async with httpx.AsyncClient(base_url=server["url"], timeout=30.0) as client:
        response = await client.get("/projects")
        print(f"Response status: {response.status_code}")

        if response.status_code == 200:
            projects = response.json()
            print(f"Number of projects: {len(projects)}")
            for p in projects:
                print(f"  - {p['name']} (id: {p['id']})")
        else:
            print(f"Error: {response.text}")


if __name__ == "__main__":
    asyncio.run(debug_test())
