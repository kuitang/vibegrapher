# Backend Phase 003: Testing Framework (Sandbox)

## Objectives
Build sandboxed test execution with resource limits.

## Implementation Tasks
1. Sandbox with subprocess + resource limits
2. Test case CRUD endpoints
3. POST /tests/{id}/run with sandboxed execution
4. Resource limits: 30s timeout, 512MB memory

## Acceptance Criteria
- ✅ Tests run in isolated subprocess
- ✅ Malicious code cannot escape sandbox
- ✅ Resource limits enforced (timeout, memory)
- ✅ Test results include stdout, stderr, exit code
- ✅ test_id returned for test runs

## Integration Test Script (httpx)
```python
# tests/integration/test_phase_003_sandbox.py
import httpx
import asyncio

async def test_sandbox_integration():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Create project
        project = await client.post("/projects", json={"name": "Sandbox Test"})
        project_id = project.json()["id"]
        
        # Create test cases
        malicious = await client.post("/tests", json={
            "project_id": project_id,
            "name": "Malicious Test",
            "input_prompt": "import os; os.system('rm -rf /')"
        })
        
        infinite = await client.post("/tests", json={
            "project_id": project_id,
            "name": "Infinite Loop",
            "input_prompt": "while True: pass"
        })
        
        memory_hog = await client.post("/tests", json={
            "project_id": project_id,
            "name": "Memory Test",
            "input_prompt": "x = [0] * (10**9)"
        })
        
        # Run malicious test - should be blocked
        malicious_run = await client.post(f"/tests/{malicious.json()['id']}/run")
        assert malicious_run.json()["status"] == "error"
        assert "permission" in malicious_run.json()["error"].lower()
        
        # Run infinite loop - should timeout
        infinite_run = await client.post(f"/tests/{infinite.json()['id']}/run")
        assert infinite_run.json()["status"] == "timeout"
        assert infinite_run.json()["runtime_seconds"] <= 31
        
        # Run memory test - should fail on memory
        memory_run = await client.post(f"/tests/{memory_hog.json()['id']}/run")
        assert memory_run.json()["status"] == "error"
        assert "memory" in memory_run.json()["error"].lower()

async def test_successful_test_run():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Full flow: create project, add code, create test, run it
        project = await client.post("/projects", json={"name": "Success Test"})
        project_id = project.json()["id"]
        
        # Add some code to project
        session = await client.post(f"/projects/{project_id}/sessions")
        session_id = session.json()["session_id"]
        
        await client.post(f"/sessions/{session_id}/messages", json={
            "prompt": "Create a simple add function"
        })
        
        # Create and run test
        test = await client.post("/tests", json={
            "project_id": project_id,
            "name": "Test Add",
            "input_prompt": "assert add(2, 3) == 5"
        })
        
        result = await client.post(f"/tests/{test.json()['id']}/run")
        assert result.json()["status"] == "passed"
        assert result.json()["test_id"] is not None
```

## Unit Tests (minimal, focused)
```python
# tests/unit/test_sandbox.py
def test_resource_limits_calculation():
    # Test that resource limit calculations are correct
    limits = SandboxService._calculate_limits()
    assert limits["timeout"] == 30
    assert limits["memory_mb"] == 512

def test_sandbox_command_construction():
    # Test that sandbox commands are properly escaped
    cmd = SandboxService._build_command("print('hello')")
    assert "timeout" in cmd
    assert "ulimit" in cmd
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/phase-003"
mkdir -p $OUTPUT_DIR

# Run integration tests
pytest tests/integration/test_phase_003_sandbox.py -v > $OUTPUT_DIR/test_output.log 2>&1

# Manual sandbox test
cat > $OUTPUT_DIR/test_script.py << 'EOF'
import httpx
import json

client = httpx.Client(base_url="http://localhost:8000")

# Create test project
project = client.post("/projects", json={"name": "Manual Sandbox Test"})
project_id = project.json()["id"]

# Create various test cases
tests = [
    {"name": "Safe", "input": "print('hello')"},
    {"name": "Network", "input": "import requests; requests.get('http://evil.com')"},
    {"name": "File", "input": "open('/etc/passwd').read()"},
]

for test_case in tests:
    test = client.post("/tests", json={
        "project_id": project_id,
        "name": test_case["name"],
        "input_prompt": test_case["input"]
    })
    
    result = client.post(f"/tests/{test.json()['id']}/run")
    print(f"{test_case['name']}: {result.json()['status']}")
EOF

python $OUTPUT_DIR/test_script.py > $OUTPUT_DIR/manual_test.log 2>&1

echo "Phase 002 validation complete"
```

## Deliverables
- [ ] SandboxService in app/services/sandbox.py
- [ ] Test endpoints in app/api/tests.py
- [ ] Integration tests in tests/integration/test_phase_003_sandbox.py
- [ ] Minimal unit tests in tests/unit/test_sandbox.py
- [ ] Validation evidence in validated_test_evidence/phase-003/