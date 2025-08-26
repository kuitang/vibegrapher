"""
Health check endpoint for deployment verification
"""

import os
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..version import __version__

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Health check endpoint that verifies:
    - Database connectivity
    - Application version
    - Deployment region
    - Environment info
    """
    response = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": __version__,
        "environment": os.getenv("ENVIRONMENT", "development"),
        "region": os.getenv("FLY_REGION", "local"),
        "app_name": os.getenv("FLY_APP_NAME", "vibegrapher-api"),
    }
    
    # Check database connectivity
    try:
        # Execute a simple query
        result = db.execute(text("SELECT 1"))
        result.scalar()
        response["database"] = "connected"
        
        # Get database type
        database_url = os.getenv("DATABASE_URL", "")
        if "postgresql" in database_url:
            response["database_type"] = "postgresql"
        elif "sqlite" in database_url:
            response["database_type"] = "sqlite"
        else:
            response["database_type"] = "unknown"
            
    except Exception as e:
        response["status"] = "unhealthy"
        response["database"] = "disconnected"
        response["error"] = str(e)
    
    return response


@router.get("/health/detailed")
def detailed_health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Detailed health check with additional metrics
    """
    base_health = health_check(db)
    
    # Add detailed metrics
    detailed = {
        **base_health,
        "checks": {
            "database": False,
            "migrations": False,
            "storage": False,
        }
    }
    
    # Check database tables exist
    try:
        result = db.execute(text("SELECT COUNT(*) FROM projects"))
        project_count = result.scalar()
        detailed["checks"]["database"] = True
        detailed["project_count"] = project_count
    except:
        pass
    
    # Check if migrations are up to date
    try:
        result = db.execute(text("SELECT version_num FROM alembic_version"))
        migration_version = result.scalar()
        if migration_version:
            detailed["checks"]["migrations"] = True
            detailed["migration_version"] = migration_version
    except:
        pass
    
    # Check storage
    media_path = "/app/media"
    if os.path.exists(media_path):
        detailed["checks"]["storage"] = True
        detailed["storage_path"] = media_path
        # Check if writable
        test_file = os.path.join(media_path, ".write_test")
        try:
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            detailed["storage_writable"] = True
        except:
            detailed["storage_writable"] = False
    
    # Calculate overall health score
    checks_passed = sum(detailed["checks"].values())
    total_checks = len(detailed["checks"])
    detailed["health_score"] = f"{checks_passed}/{total_checks}"
    
    if checks_passed < total_checks:
        detailed["status"] = "degraded"
    
    return detailed