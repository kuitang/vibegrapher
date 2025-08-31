"""
Mock implementations for OpenAI Agents SDK
Enables testing without hitting real OpenAI APIs while maintaining identical data structures.
"""

import os

# Global flag to enable/disable mocking
USE_OPENAI_MOCKS = os.getenv("USE_OPENAI_MOCKS", "false").lower() == "true"


def get_runner_class():
    """Get the appropriate Runner class based on mock setting"""
    if USE_OPENAI_MOCKS:
        from .openai_agents_sdk import MockRunner

        return MockRunner
    else:
        from agents import Runner

        return Runner


# Monkey patch for seamless integration
if USE_OPENAI_MOCKS:
    import agents

    from .openai_agents_sdk import MockRunner

    agents.Runner = MockRunner
