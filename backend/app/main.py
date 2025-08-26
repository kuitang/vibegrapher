import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import projects, tests
from .config import settings
from .database import init_db
from .services.socketio_service import socketio_manager

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
fastapi_app = FastAPI(title="Vibegrapher Backend", version="0.1.0")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(projects.router)
fastapi_app.include_router(tests.router)


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


@fastapi_app.get("/health")
async def health_check() -> dict:
    return {"status": "healthy"}


# Wrap with Socket.io
app = socketio_manager.create_app(fastapi_app)
