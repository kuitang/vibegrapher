"""
Global error handling middleware for FastAPI

This middleware catches all unhandled exceptions and:
1. Sends full stack traces to client via Socket.io in development
2. Logs errors with context in production
3. Distinguishes between expected operational errors and programming bugs
"""

import logging
import traceback
from collections.abc import Callable

from fastapi import HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.middleware.base import BaseHTTPMiddleware

from ..config import settings
from ..services.socketio_service import socketio_manager
from ..utils.error_handling import format_error_for_client

logger = logging.getLogger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle all exceptions globally.

    Philosophy:
    - Programming errors (bugs) should fail fast with full stack traces
    - Operational errors (network, external APIs) should have recovery logic
    - User input errors should return clear validation messages
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response

        except HTTPException:
            # HTTPException is already handled by FastAPI
            # These are intentional user-facing errors
            raise

        except RequestValidationError as e:
            # Pydantic validation errors - user input problem
            logger.info(f"Validation error on {request.url.path}: {e.errors()}")
            return JSONResponse(
                status_code=422, content={"detail": e.errors(), "body": e.body}
            )

        except ValidationError as e:
            # Other validation errors
            logger.info(f"Validation error on {request.url.path}: {e.errors()}")
            return JSONResponse(status_code=400, content={"detail": e.errors()})

        except Exception as e:
            # PROGRAMMING ERROR - this should not happen
            # Log with full stack trace
            logger.error(
                f"Unhandled exception on {request.method} {request.url.path}",
                exc_info=True,
                extra={
                    "request_id": request.headers.get("X-Request-ID"),
                    "user_agent": request.headers.get("User-Agent"),
                    "method": request.method,
                    "path": request.url.path,
                    "query": str(request.url.query),
                },
            )

            # Format error with full stack trace
            error_data = format_error_for_client(
                error=e,
                include_stack_trace=True,
                context=f"{request.method} {request.url.path}",
            )

            # In development, send everything to client via Socket.io
            if settings.debug:
                # Emit to all connected clients for visibility
                try:
                    await socketio_manager.emit_to_all(
                        event="dev_error",
                        data={
                            **error_data,
                            "request_path": request.url.path,
                            "request_method": request.method,
                            "request_headers": dict(request.headers),
                        },
                    )
                except Exception as emit_error:
                    logger.error(f"Failed to emit error via Socket.io: {emit_error}")

            # Re-raise to let FastAPI's default error handler deal with it
            # This ensures proper 500 response and doesn't hide the error
            raise


class APIErrorMiddleware:
    """
    Alternative middleware specifically for API endpoints.
    Returns JSON errors instead of re-raising.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            # Log the error
            logger.error(f"API error: {e}", exc_info=True)

            # Send error response
            response = JSONResponse(
                status_code=500,
                content={
                    "error": str(e) if settings.debug else "Internal server error",
                    "type": e.__class__.__name__,
                    "stack_trace": traceback.format_exc() if settings.debug else None,
                },
            )

            await response(scope, receive, send)


def setup_error_handlers(app):
    """
    Setup all error handlers for the FastAPI app.
    Call this from main.py after creating the app.
    """

    # Add middleware
    app.add_middleware(ErrorHandlerMiddleware)

    # Custom exception handlers for specific exceptions
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        """Handle Pydantic validation errors with better formatting"""
        return JSONResponse(
            status_code=422,
            content={
                "detail": exc.errors(),
                "body": exc.body,
                "message": "Validation failed for request data",
            },
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        """Handle ValueError which often indicates programming errors"""
        logger.error(f"ValueError on {request.url.path}: {exc}", exc_info=True)

        if settings.debug:
            return JSONResponse(
                status_code=500,
                content={
                    "error": str(exc),
                    "type": "ValueError",
                    "stack_trace": traceback.format_exc(),
                    "message": "A programming error occurred - this should be fixed",
                },
            )
        else:
            return JSONResponse(
                status_code=500, content={"message": "Internal server error"}
            )

    logger.info("Error handlers configured")
