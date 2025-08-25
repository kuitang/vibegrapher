# Backend Phase 005: AST Parser

## Objectives
Parse Python code to extract and update Agent() definitions.

## AgentNode Class Definition
```python
from typing import List

class AgentNode:
    def __init__(self, name: str, line_start: int, line_end: int, children: List[str] = None):
        self.name = name
        self.line_start = line_start
        self.line_end = line_end
        self.children = children or []  # Names of child agents if any
```

## Implementation Tasks
1. Parse Python to extract Agent() definitions
2. Track node positions in file
3. Update specific nodes
4. Handle nested and complex agent definitions

## Acceptance Criteria
- ✅ Extract all Agent() calls with name, line numbers
- ✅ Parse agent properties (tools, handoffs, instructions)
- ✅ Update specific agent without affecting others
- ✅ Handle edge cases (multiline, nested definitions)

## Expected Test Results
```python
def test_parse_agents():
    code = """agent1 = Agent(name='Bot1')
    agent2 = Agent(
        name='Bot2',
        tools=[tool1, tool2]
    )"""
    agents = ast_parser.parse_agents(code)
    assert len(agents) == 2
    assert agents[0].name == 'Bot1'
    assert agents[0].line_start == 1
    assert agents[1].name == 'Bot2'
    assert agents[1].line_start == 2

def test_update_node():
    new_code = ast_parser.update_node(code, "Bot1", new_definition)
    assert "Bot1" not in new_code or new_definition in new_code

def test_multiline_agent():
    code = """
    complex_agent = Agent(
        name="ComplexBot",
        instructions='''Multi
        line
        instructions''',
        tools=[
            tool1,
            tool2
        ]
    )
    """
    agents = ast_parser.parse_agents(code)
    assert agents[0].line_start == 2
    assert agents[0].line_end == 10
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/phase-005"
mkdir -p $OUTPUT_DIR

# Run AST parser tests
pytest tests/integration/test_phase_005_ast.py -v > $OUTPUT_DIR/test_output.log 2>&1

# Test with real agent code
python -c "
from app.services.ast_parser import ASTParserService
parser = ASTParserService()
with open('sample_agents.py') as f:
    code = f.read()
agents = parser.parse_agents(code)
print(f'Found {len(agents)} agents')
for agent in agents:
    print(f'  - {agent.name} at line {agent.line_start}')
" > $OUTPUT_DIR/parse_results.txt

echo "Phase 005 validation complete"
```

## Deliverables
- [ ] ASTParserService in app/services/ast_parser.py
- [ ] Tests in tests/integration/test_phase_005_ast.py
- [ ] Sample agent files for testing
- [ ] Validation evidence in validated_test_evidence/phase-005/