"""
All OpenAI Agents for Vibegrapher
VibeCoder and Evaluator agents with patch submission workflow
"""

import ast
import asyncio
import json
import logging
import os
import re
from typing import Any, Dict, Optional

from openai import AsyncOpenAI
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

# Model configurations - use the actual models specified
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-4o",  # Using gpt-4o as thinking model
    "SMALL_MODEL": "gpt-4o-mini"  # Using gpt-4o-mini as small model  
}

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


class EvaluationResult(BaseModel):
    """Result from evaluator agent"""
    approved: bool
    reasoning: str
    commit_message: str  # Suggested commit message if approved


class PatchValidationResult(BaseModel):
    """Result from patch validation"""
    valid: bool
    error: Optional[str] = None
    patched_code: Optional[str] = None


def apply_patch(original_code: str, patch: str) -> Optional[str]:
    """Apply a patch to the original code"""
    try:
        lines = original_code.split('\n')
        patch_lines = patch.strip().split('\n')
        
        # Parse the patch format (simplified unified diff)
        # Looking for patterns like:
        # @@ -line,count +line,count @@
        # -removed line
        # +added line
        #  context line
        
        result = lines.copy()
        i = 0
        while i < len(patch_lines):
            line = patch_lines[i]
            if line.startswith('@@'):
                # Parse the line numbers
                match = re.match(r'@@ -(\d+),?\d* \+(\d+),?\d* @@', line)
                if match:
                    old_start = int(match.group(1)) - 1
                    new_start = int(match.group(2)) - 1
                    
                    # Process the patch content
                    i += 1
                    while i < len(patch_lines) and not patch_lines[i].startswith('@@'):
                        patch_line = patch_lines[i]
                        if patch_line.startswith('-'):
                            # Remove line
                            if old_start < len(result):
                                result.pop(old_start)
                        elif patch_line.startswith('+'):
                            # Add line
                            result.insert(new_start, patch_line[1:])
                            new_start += 1
                        else:
                            # Context line
                            old_start += 1
                            new_start += 1
                        i += 1
                    continue
            i += 1
        
        return '\n'.join(result)
    except Exception as e:
        logger.error(f"Error applying patch: {e}")
        return None


def validate_patch(original: str, patch: str) -> PatchValidationResult:
    """
    Apply patch and check syntax in ONE STEP
    Returns validation result with VERBATIM error if invalid
    """
    # 1. Apply patch to temp copy
    patched_code = apply_patch(original, patch)
    
    if patched_code is None:
        return PatchValidationResult(
            valid=False,
            error="Failed to apply patch: invalid patch format"
        )
    
    # 2. Run Python syntax check on result
    try:
        ast.parse(patched_code)
        return PatchValidationResult(
            valid=True,
            patched_code=patched_code
        )
    except SyntaxError as e:
        # Return VERBATIM error
        error_msg = f"SyntaxError: {e.msg} at line {e.lineno}"
        if e.text:
            error_msg += f"\n  {e.text.strip()}"
            if e.offset:
                error_msg += f"\n  {' ' * (e.offset - 1)}^"
        
        return PatchValidationResult(
            valid=False,
            error=error_msg
        )


class VibeCoder:
    """VibeCoder agent that generates patches or answers questions"""
    
    def __init__(self):
        self.model = MODEL_CONFIGS["THINKING_MODEL"]
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate(
        self, 
        prompt: str, 
        current_code: str,
        evaluator_feedback: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a response - either a patch or text"""
        
        system_prompt = """You are VibeCoder, an AI assistant that helps modify code.

You have TWO response modes:
1. Submit a patch using the submit_patch function when code changes are needed
2. Return a text response when answering questions or explaining code

When creating patches:
- Generate unified diff format patches
- Include clear descriptions of changes
- Consider any previous evaluator feedback

Current code:
```python
{code}
```

{feedback}
"""
        
        feedback_text = ""
        if evaluator_feedback:
            feedback_text = f"\nPrevious evaluator feedback:\n{evaluator_feedback}"
        
        messages = [
            {"role": "system", "content": system_prompt.format(
                code=current_code,
                feedback=feedback_text
            )},
            {"role": "user", "content": prompt}
        ]
        
        # Check if this is likely a patch request
        patch_keywords = ['add', 'modify', 'change', 'update', 'create', 'implement', 'fix', 'refactor']
        is_patch_request = any(keyword in prompt.lower() for keyword in patch_keywords)
        
        if is_patch_request:
            # Use function calling for patches
            tools = [{
                "type": "function",
                "function": {
                    "name": "submit_patch",
                    "description": "Submit a code patch for evaluation",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "patch": {
                                "type": "string",
                                "description": "The unified diff format patch"
                            },
                            "description": {
                                "type": "string",
                                "description": "Description of what this patch does"
                            }
                        },
                        "required": ["patch", "description"]
                    }
                }
            }]
            
            response = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice="auto"
            )
        else:
            # Regular text response
            response = await client.chat.completions.create(
                model=self.model,
                messages=messages
            )
        
        # Log token usage
        if response.usage:
            logger.info(f"💵 OPENAI TOKENS - VibeCoder: {response.usage.total_tokens} total "
                       f"({response.usage.prompt_tokens} prompt, {response.usage.completion_tokens} completion)")
        
        # Parse response
        if response.choices[0].message.tool_calls:
            # Patch submission
            tool_call = response.choices[0].message.tool_calls[0]
            args = json.loads(tool_call.function.arguments)
            return {
                "type": "patch",
                "patch": args["patch"],
                "description": args["description"],
                "usage": response.usage.model_dump() if response.usage else None
            }
        else:
            # Text response
            return {
                "type": "text",
                "content": response.choices[0].message.content,
                "usage": response.usage.model_dump() if response.usage else None
            }


class Evaluator:
    """Evaluator agent that reviews patches and suggests commit messages"""
    
    def __init__(self):
        self.model = MODEL_CONFIGS["THINKING_MODEL"]
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def evaluate(
        self,
        original_code: str,
        patched_code: str,
        patch_description: str,
        user_prompt: str
    ) -> EvaluationResult:
        """Evaluate a patch and suggest a commit message"""
        
        system_prompt = """You are the Evaluator, reviewing code patches for quality and correctness.

Evaluate the patch based on:
1. Does it correctly implement what was requested?
2. Is the code quality good (readable, maintainable)?
3. Does it follow Python best practices?
4. Are there any potential bugs or issues?

If you approve the patch, suggest a clear, concise commit message.
Be somewhat lenient - approve patches that reasonably address the request.

Return your evaluation as JSON with these fields:
- approved: boolean
- reasoning: string explaining your decision
- commit_message: string (if approved, suggest a commit message)
"""
        
        user_message = f"""User requested: {user_prompt}

Patch description: {patch_description}

Original code:
```python
{original_code}
```

Patched code:
```python  
{patched_code}
```

Evaluate this patch."""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"}
        )
        
        # Log token usage
        if response.usage:
            logger.info(f"💵 OPENAI TOKENS - Evaluator: {response.usage.total_tokens} total "
                       f"({response.usage.prompt_tokens} prompt, {response.usage.completion_tokens} completion)")
        
        # Parse JSON response
        result = json.loads(response.choices[0].message.content)
        
        return EvaluationResult(
            approved=result.get("approved", False),
            reasoning=result.get("reasoning", ""),
            commit_message=result.get("commit_message", "")
        )


# Global instances
vibecoder_agent = VibeCoder()
evaluator_agent = Evaluator()