"""
Mock agents for testing without OpenAI API key
"""
import asyncio
import uuid
from typing import Optional, Dict, Any
from datetime import datetime

from app.services.socketio_service import socketio_manager

class MockVibeCoder:
    """Mock VibeCoder agent for testing"""
    
    async def stream_response(
        self,
        session_id: str,
        project_id: str,
        prompt: str,
        iteration: int = 1
    ) -> str:
        """Stream a mock response"""
        message_id = str(uuid.uuid4())
        
        # Emit start
        await socketio_manager.emit_conversation_message(
            session_id=session_id,
            project_id=project_id,
            message_id=message_id,
            role="assistant",
            agent="vibecoder",
            content="",
            patch_preview=None,
            iteration=iteration,
            token_usage=None,
        )
        
        # Mock response
        response = f"""I'll create an efficient Fibonacci function using memoization:

```python
def fibonacci(n, memo=None):
    \"\"\"Calculate fibonacci number efficiently using memoization\"\"\"
    if memo is None:
        memo = {}
    
    if n in memo:
        return memo[n]
    
    if n <= 1:
        return n
    
    memo[n] = fibonacci(n-1, memo) + fibonacci(n-2, memo)
    return memo[n]

# Test the function
for i in range(10):
    print(f"fib({i}) = {fibonacci(i)}")
```

This implementation uses memoization to avoid recalculating values."""
        
        # Simulate streaming by sending chunks
        chunks = response.split(' ')
        accumulated = ""
        
        for i, chunk in enumerate(chunks):
            accumulated += chunk + " "
            await asyncio.sleep(0.05)  # Simulate typing delay
            
            await socketio_manager.emit_conversation_message(
                session_id=session_id,
                project_id=project_id,
                message_id=message_id,
                role="assistant",
                agent="vibecoder",
                content=accumulated.strip(),
                patch_preview=None,
                iteration=iteration,
                token_usage={"prompt_tokens": 10, "completion_tokens": i+1},
            )
        
        return accumulated.strip()


class MockEvaluator:
    """Mock Evaluator agent for testing"""
    
    async def stream_response(
        self,
        session_id: str,
        project_id: str,
        code: str,
        iteration: int = 1
    ) -> Dict[str, Any]:
        """Stream a mock evaluation"""
        message_id = str(uuid.uuid4())
        
        # Emit start
        await socketio_manager.emit_conversation_message(
            session_id=session_id,
            project_id=project_id,
            message_id=message_id,
            role="system",
            agent="evaluator",
            content="",
            patch_preview=None,
            iteration=iteration,
            token_usage=None,
        )
        
        # Mock evaluation
        if iteration < 2:
            response = "The implementation looks good but could use better error handling for negative numbers."
            approved = False
        else:
            response = "Excellent! The implementation is efficient and handles edge cases properly."
            approved = True
        
        # Simulate streaming
        accumulated = ""
        for char in response:
            accumulated += char
            await asyncio.sleep(0.01)
            
            await socketio_manager.emit_conversation_message(
                session_id=session_id,
                project_id=project_id,
                message_id=message_id,
                role="system", 
                agent="evaluator",
                content=accumulated,
                patch_preview=None,
                iteration=iteration,
                token_usage={"prompt_tokens": 5, "completion_tokens": len(accumulated)},
            )
        
        return {
            "approved": approved,
            "feedback": response,
            "reasoning": f"Iteration {iteration} evaluation complete"
        }


# Export mock instances
mock_vibecoder = MockVibeCoder()
mock_evaluator = MockEvaluator()