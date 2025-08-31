"""
Error handling utilities for sending detailed error information to clients
"""

import logging
import traceback
from typing import Any

logger = logging.getLogger(__name__)


def format_error_for_client(
    error: Exception, include_stack_trace: bool = True, context: str | None = None
) -> dict[str, Any]:
    """
    Format an exception for sending to the client with full stack trace.

    Args:
        error: The exception that occurred
        include_stack_trace: Whether to include the full stack trace
        context: Optional context about where the error occurred

    Returns:
        Dictionary with error details suitable for client consumption
    """
    error_dict = {
        "error": str(error),
        "error_type": error.__class__.__name__,
        "context": context,
    }

    if include_stack_trace:
        # Get the full stack trace
        error_dict["stack_trace"] = traceback.format_exc()

        # Also include formatted traceback as separate lines for better display
        tb_lines = traceback.format_exception(
            type(error),
            error,
            error.__cause__.__traceback__ if error.__cause__ else error.__traceback__,
        )
        error_dict["traceback_lines"] = tb_lines

    return error_dict


async def emit_error_to_client(
    socketio_manager,
    project_id: str,
    error: Exception,
    event_name: str = "vibecode_error",
    context: str | None = None,
    include_stack_trace: bool = True,
):
    """
    Emit an error to the client via Socket.io with full stack trace.

    Args:
        socketio_manager: The Socket.io manager instance
        project_id: Project ID to emit to
        error: The exception that occurred
        event_name: The Socket.io event name to emit
        context: Optional context about where the error occurred
        include_stack_trace: Whether to include the full stack trace
    """
    error_data = format_error_for_client(
        error=error, include_stack_trace=include_stack_trace, context=context
    )

    # Log the error server-side as well
    logger.error(
        f"Emitting error to client - Context: {context}, Error: {error}", exc_info=True
    )

    # Emit to the project room
    await socketio_manager.emit_to_project(
        project_id=project_id, event=event_name, data=error_data
    )


def log_and_format_error(
    error: Exception,
    context: str | None = None,
    logger_instance: logging.Logger | None = None,
) -> dict[str, Any]:
    """
    Log an error and return formatted error data.

    Args:
        error: The exception that occurred
        context: Optional context about where the error occurred
        logger_instance: Logger to use (defaults to module logger)

    Returns:
        Dictionary with error details suitable for client consumption
    """
    if logger_instance is None:
        logger_instance = logger

    # Log with full traceback
    logger_instance.error(
        f"Error in {context or 'unknown context'}: {error}", exc_info=True
    )

    # Return formatted error for client
    return format_error_for_client(
        error=error, include_stack_trace=True, context=context
    )
