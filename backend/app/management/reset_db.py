import os
import sys
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Base, Project

sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def reset_and_seed_database(database_url: Optional[str] = None) -> None:
    url = database_url or settings.database_url

    if "sqlite" in url:
        db_file = url.replace("sqlite:///", "")
        if os.path.exists(db_file):
            os.remove(db_file)
            print(f"Removed existing database: {db_file}")

    engine = create_engine(
        url, connect_args={"check_same_thread": False} if "sqlite" in url else {}
    )

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    Session = sessionmaker(bind=engine)
    db = Session()

    sample_projects = [
        {"name": "Todo App", "slug": "todo-app"},
        {"name": "Weather Dashboard", "slug": "weather-dashboard"},
        {"name": "Chat Interface", "slug": "chat-interface"},
    ]

    for proj_data in sample_projects:
        repository_path = os.path.join(
            settings.media_path, "projects", proj_data["slug"]
        )
        project = Project(
            name=proj_data["name"],
            slug=proj_data["slug"],
            repository_path=repository_path,
            current_branch="main",
        )
        db.add(project)

    db.commit()
    db.close()

    print(f"Database reset and seeded successfully at: {url}")
    print(f"Added {len(sample_projects)} sample projects")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Reset and seed database")
    parser.add_argument("--test-db", action="store_true", help="Reset test database")
    args = parser.parse_args()

    if args.test_db:
        reset_and_seed_database(settings.test_database_url)
    else:
        reset_and_seed_database()
