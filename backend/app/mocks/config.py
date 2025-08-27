"""
Configuration management for OpenAI Agents SDK mocks
"""

import json
import os
from dataclasses import dataclass


@dataclass
class MockConfig:
    """Configuration for mock behavior"""

    # Enable/disable mocking
    enabled: bool = False

    # Mock behavior settings
    simulate_delays: bool = True
    base_delay_ms: int = 100
    random_delay_range_ms: int = 50

    # Scenario selection
    default_scenario: str = "comment_addition_approved"
    scenario_weights: dict[str, float] | None = None

    # Failure simulation
    simulate_failures: bool = False
    failure_rate: float = 0.05

    # Logging
    log_mock_events: bool = True
    log_file: str = "mock_events.log"


def get_mock_config() -> MockConfig:
    """Get mock configuration from environment"""

    # Check if mocking is enabled
    enabled = os.getenv("USE_OPENAI_MOCKS", "false").lower() == "true"

    if not enabled:
        return MockConfig(enabled=False)

    # Try to get configuration from JSON environment variable
    config_json = os.getenv("OPENAI_MOCK_CONFIGS", "{}")

    try:
        config_data = json.loads(config_json)
    except json.JSONDecodeError:
        config_data = {}

    # Create config with defaults, overridden by environment data
    config = MockConfig(
        enabled=enabled,
        simulate_delays=config_data.get("simulate_delays", True),
        base_delay_ms=config_data.get("base_delay_ms", 100),
        random_delay_range_ms=config_data.get("random_delay_range_ms", 50),
        default_scenario=config_data.get(
            "default_scenario", "comment_addition_approved"
        ),
        scenario_weights=config_data.get("scenario_weights"),
        simulate_failures=config_data.get("simulate_failures", False),
        failure_rate=config_data.get("failure_rate", 0.05),
        log_mock_events=config_data.get("log_mock_events", True),
        log_file=config_data.get("log_file", "mock_events.log"),
    )

    return config


# Global configuration instance
mock_config = get_mock_config()
