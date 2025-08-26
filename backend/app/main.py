import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import projects
from .config import settings
from .database import init_db

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Vibegrapher Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)


@app.on_event("startup")
async def startup_event() -> None:
    init_db()
    logger.info("Database initialized")


@app.get("/health")
async def health_check() -> dict:
    return {"status": "healthy"}
