"""
All OpenAI Agents for Vibegrapher
VibeCoder and Evaluator agents with patch submission workflow
"""

import ast
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from agents import Agent, Runner, function_tool, SQLiteSession
from pydantic import BaseModel

from ..utils.diff_parser import diff_parser

logger = logging.getLogger(__name__)

# Model configurations - use gpt-5 series
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5",  # REAL MODEL - DO NOT USE gpt-4o!
    "SMALL_MODEL": "gpt-5"  # REAL MODEL - DO NOT USE gpt-4o!
}


# Define EvaluationResult Pydantic model - INCLUDES COMMIT MESSAGE
class EvaluationResult(BaseModel):
    approved: bool
    reasoning: str
    commit_message: str  # Suggested commit message if approved


# Validation function - apply patch then check syntax in ONE STEP
def validate_patch(original: str, patch: str) -> dict:
    """
    Apply patch and check syntax in ONE STEP
    Returns validation result with VERBATIM error if invalid
    """
    # 1. Apply patch to temp copy
    patched_code = diff_parser.apply_patch(original, patch)
    
    if patched_code is None:
        return {"valid": False, "error": "Failed to apply patch: malformed diff format"}
    
    # 2. Run Python syntax check on result
    try:
        ast.parse(patched_code)
        return {"valid": True, "patched_code": patched_code}
    except SyntaxError as e:
        # 3. Return VERBATIM error if invalid
        return {"valid": False, "error": f"SyntaxError: {e.msg} at line {e.lineno}"}


# Evaluator agent
evaluator_agent = Agent(
    name="Evaluator",
    model=MODEL_CONFIGS["THINKING_MODEL"],
    instructions="""You are an expert code reviewer who evaluates patches for quality and correctness.

Review the submitted patch and:
1. Assess if the changes are appropriate and safe
2. Check if the changes achieve the stated goal
3. Suggest improvements if needed
4. Provide a clear, concise commit message

Be lenient and approve reasonable changes. Focus on:
- Does the patch apply cleanly?
- Is the syntax valid?
- Does it achieve the user's goal?

Always provide constructive feedback and a suggested commit message.

Your response must be in the format:
approved: true/false
reasoning: your evaluation
commit_message: suggested commit message""",
    output_type=EvaluationResult  # Now includes commit_message field
)


class VibecodeResult(BaseModel):
    content: Optional[str] = None  # if we fail
    diff_id: Optional[str] = None  # if we succeed
    openai_response: Any  # Full OpenAI response object


class VibecodeService:
    """Service for handling vibecode requests with agent interaction"""
    
    def __init__(self):
        self.last_iteration_count = 0
    
    async def vibecode(
        self,
        project_id: str,
        prompt: str,
        current_code: str,
        project_slug: str,
        node_id: Optional[str] = None,
        session_id: Optional[str] = None,
        socketio_manager=None
    ) -> VibecodeResult:
        """Main vibecode workflow with agent interaction"""
        # CRITICAL REQUIREMENT: Real-time AI Response Streaming
        # Every time we get a response from VibeCoder or Evaluator:
        # 1. Emit Socket.io 'conversation_message' event immediately (priority #1)
        # 2. Asynchronously save ConversationMessage to database (background task)
        # 3. Frontend displays message in real-time
        # DO NOT wait for database save - stream first, save second
        
        # Create session key with correct format (uses project.slug for consistency)
        session_key = f"project_{project_slug}_node_{node_id}" if node_id else f"project_{project_slug}"
        
        # Use project.slug for filesystem paths to ensure valid filenames
        db_path = f"media/projects/{project_slug}_conversations.db"
        
        # Ensure media directory exists
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        
        # MUST use file persistence, not in-memory
        session = SQLiteSession(session_key, db_path)
        evaluator_session_key = session_key + "_evaluator"
        evaluator_session = SQLiteSession(evaluator_session_key, db_path)
        
        # Define submit_patch as a nested function to capture current_code and evaluator_session
        @function_tool
        async def submit_patch(patch: str, description: str) -> EvaluationResult:
            """Submit a patch for evaluation.
            
            Args:
                patch: The unified diff patch to apply
                description: Description of the changes made
            """
            # 1. Use current_code from closure
            # 2. Run validate_patch() - single step validation
            validation = validate_patch(current_code, patch)
            
            # 3. If invalid, return verbatim error to user
            if not validation["valid"]:
                return EvaluationResult(
                    approved=False,
                    reasoning=f"Patch validation failed: {validation['error']}",
                    commit_message=""
                )
            
            # 4. If valid, call the evaluator using evaluator_session from closure
            eval_prompt = f"""Please review this patch:

{patch}

Description: {description}

Original code:
```python
{current_code}
```

Patched code:
```python
{validation['patched_code']}
```
"""
            
            # Run evaluator agent
            result = await Runner.run(
                evaluator_agent, 
                eval_prompt, 
                session=evaluator_session
            )
            
            # 5. Return with the evaluator's decision
            return result.final_output
        
        # Create VibeCoder agent with the submit_patch tool
        vibecoder_agent = Agent(
            name="Vibecoder",
            model=MODEL_CONFIGS["THINKING_MODEL"],
            instructions="""You are VibeCoder, an expert Python developer who helps modify code.

You have TWO response modes:

1. PATCH MODE: When the user asks to modify, add, or change code, use the submit_patch tool.
   - Generate a unified diff patch in proper format
   - Include a clear description of changes
   - The patch should be in unified diff format like:
     ```
     @@ -line,count +line,count @@
     -removed line
     +added line
      context line
     ```
   
2. TEXT MODE: When the user asks questions about code or needs explanations, respond with text.
   - Explain code functionality
   - Answer questions
   - Provide guidance

Current code is provided in the user message.

IMPORTANT: 
- When generating patches, use proper unified diff format
- Include context lines for clarity
- Make minimal, focused changes
- Ensure the patched code is syntactically valid""",
            tools=[submit_patch]
        )
        
        try:
            for iteration in range(3):  # MAX 3 iterations
                self.last_iteration_count = iteration + 1
                
                # Build user prompt with current code
                user_prompt = f"Current code:\n```python\n{current_code}\n```\n\nUser request: {prompt}"
                
                # Run VibeCoder with context
                vibecoder_response = await Runner.run(
                    vibecoder_agent, 
                    user_prompt,
                    session=session
                )
                
                # CRITICAL: Immediately stream VibeCoder response to frontend
                await self._stream_agent_response(
                    vibecoder_response, 'vibecoder', iteration, session_id, socketio_manager
                )
                
                # Check if patch was submitted by looking at the tool call outputs
                evaluation = None
                if hasattr(vibecoder_response, 'new_items'):
                    for item in vibecoder_response.new_items:
                        # Look for tool call output items
                        if hasattr(item, 'output') and isinstance(item.output, EvaluationResult):
                            evaluation = item.output
                            break
                
                if evaluation:
                    # Evaluator was called via submit_patch
                    # CRITICAL: Immediately stream Evaluator response to frontend
                    await self._stream_agent_response(
                        evaluation, 'evaluator', iteration, session_id, socketio_manager
                    )
                    
                    if evaluation.approved:
                        # Create Diff record with status='evaluator_approved'
                        # This will be handled by the API layer
                        return VibecodeResult(
                            diff_id="generated-diff-id",  # Will be replaced by actual diff creation
                            openai_response=vibecoder_response
                        )
                    else:
                        # If rejected, loop with feedback
                        prompt = f"The evaluator rejected your patch. Feedback: {evaluation.reasoning}\n\nPlease try again."
                        continue
                else:
                    # Text response mode - no patch submitted
                    return VibecodeResult(
                        content=vibecoder_response.final_output if hasattr(vibecoder_response, 'final_output') else str(vibecoder_response),
                        openai_response=vibecoder_response
                    )
            
            # Max iterations reached
            return VibecodeResult(
                content="Maximum iteration limit reached without approval",
                openai_response=None
            )
            
        except Exception as e:
            logger.error(f"Error in vibecode: {e}", exc_info=True)
            raise
    
    async def _stream_agent_response(self, response, agent_type: str, iteration: int, session_id: str, socketio_manager):
        """Stream agent response to frontend via Socket.io"""
        # 1. IMMEDIATELY emit Socket.io 'conversation_message' event (no delay)
        # 2. Fire-and-forget background task to save ConversationMessage to database
        # 3. Include agent type, iteration, and token usage in Socket.io event
        
        try:
            # Extract content from response
            content = ""
            if hasattr(response, 'final_output'):
                if isinstance(response.final_output, EvaluationResult):
                    content = f"Approved: {response.final_output.approved}\nReasoning: {response.final_output.reasoning}\nCommit Message: {response.final_output.commit_message}"
                else:
                    content = str(response.final_output)
            else:
                content = str(response)
            
            # Extract token usage if available
            token_usage = {}
            if hasattr(response, 'usage'):
                token_usage = {
                    'total_tokens': response.usage.total_tokens if hasattr(response.usage, 'total_tokens') else 0,
                    'prompt_tokens': response.usage.prompt_tokens if hasattr(response.usage, 'prompt_tokens') else 0,
                    'completion_tokens': response.usage.completion_tokens if hasattr(response.usage, 'completion_tokens') else 0,
                }
                
                # Log token usage
                logger.info(f"💵 OPENAI TOKENS: prompt={token_usage.get('prompt_tokens', 0)}, completion={token_usage.get('completion_tokens', 0)}, total={token_usage.get('total_tokens', 0)}")
            
            # Emit first (priority #1 - user sees response immediately)
            if socketio_manager and session_id:
                await socketio_manager.emit_to_room(
                    session_id,
                    'conversation_message',
                    {
                        'agent_type': agent_type,
                        'iteration': iteration,
                        'content': content,
                        'token_usage': token_usage
                    }
                )
            
            # Database save in background (priority #2)
            asyncio.create_task(self._save_conversation_message_async(response, agent_type, iteration, session_id))
            
        except Exception as e:
            logger.error(f"Error streaming agent response: {e}")
    
    async def _save_conversation_message_async(self, response, agent_type: str, iteration: int, session_id: str):
        """Save conversation message to database asynchronously"""
        # This would save to the database - implementation depends on your database models
        pass
    
    async def handle_human_rejection(self, diff_id: str, feedback: str, project_id: str, project_slug: str, current_code: str):
        """Handle human rejection of a diff"""
        # Get rejected diff
        # Create new prompt with human feedback
        prompt = f"The human reviewer rejected the changes with this feedback: {feedback}\n\nPlease address the feedback and try again."
        
        # Call vibecode() again with new prompt
        return await self.vibecode(
            project_id=project_id,
            prompt=prompt,
            current_code=current_code,
            project_slug=project_slug
        )


# Global instance
vibecode_service = VibecodeService()