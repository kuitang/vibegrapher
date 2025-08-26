from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./vibegrapher.db"
    test_database_url: str = "sqlite:///./test_vibegrapher.db"
    openai_api_key: str = "sk-placeholder"
    cors_origins: str = "*"
    port: int = 8000
    host: str = "0.0.0.0"
    media_path: str = "media"

    class Config:
        env_file = ".env"

    def get_cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
