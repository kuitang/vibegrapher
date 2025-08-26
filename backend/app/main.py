import logging
import traceback
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import diffs, health, projects, sessions, tests
from .config import settings
from .database import init_db
from .services.socketio_service import socketio_manager
from .version import __version__

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG if settings.environment == "development" else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
fastapi_app = FastAPI(title="Vibegrapher Backend", version=__version__)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(health.router)
fastapi_app.include_router(projects.router)
fastapi_app.include_router(tests.router)
fastapi_app.include_router(sessions.router)
fastapi_app.include_router(diffs.router)


# Custom exception handler for HTTPException
@fastapi_app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Log full details for HTTP exceptions"""
    # Log the full stack trace for debugging
    logger.exception(
        f"HTTP {exc.status_code} error at {request.url.path}\n"
        f"Detail: {exc.detail}\n"
        f"Headers: {exc.headers}\n"
        f"Request method: {request.method}\n"
        f"Client: {request.client}\n"
        f"Stack trace:\n{''.join(traceback.format_stack())}"
    )

    return JSONResponse(
        status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers
    )


# Custom exception handler for all other exceptions
@fastapi_app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Log full stack trace for unexpected exceptions"""
    logger.exception(
        f"Unexpected error at {request.url.path}\n"
        f"Exception type: {type(exc).__name__}\n"
        f"Exception: {str(exc)}\n"
        f"Request method: {request.method}\n"
        f"Client: {request.client}\n"
        f"Full stack trace:\n{traceback.format_exc()}"
    )

    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@fastapi_app.on_event("startup")
async def startup_event() -> None:
    init_db()
    logger.info("Database initialized")
    # Start Socket.io heartbeat
    await socketio_manager.start_heartbeat()
    logger.info("Socket.io heartbeat started")


@fastapi_app.on_event("shutdown")
async def shutdown_event() -> None:
    await socketio_manager.stop_heartbeat()
    logger.info("Socket.io heartbeat stopped")


# Remove duplicate health endpoint - using the one from health.py router


# Wrap with Socket.io
app = socketio_manager.create_app(fastapi_app)
