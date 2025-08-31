"""Middleware for the Vibegrapher backend"""

from .error_handler import ErrorHandlerMiddleware, setup_error_handlers

__all__ = ["ErrorHandlerMiddleware", "setup_error_handlers"]
