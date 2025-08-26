import os
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DATABASE_URL is automatically set by Fly.io when PostgreSQL is attached
    # Fall back to SQLite for local development
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./vibegrapher.db")
    test_database_url: str = "sqlite:///./test_vibegrapher.db"
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "sk-placeholder")
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")
    port: int = int(os.getenv("PORT", "8000"))
    host: str = os.getenv("HOST", "0.0.0.0")
    media_path: str = os.getenv("MEDIA_PATH", "/app/media" if os.path.exists("/app/media") else "media")
    environment: str = os.getenv("ENVIRONMENT", "development")

    class Config:
        env_file = ".env"

    def get_cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    def is_production(self) -> bool:
        return self.environment == "production"

    def is_preview(self) -> bool:
        return self.environment == "preview"


settings = Settings()
