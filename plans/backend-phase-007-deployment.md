# Backend Phase 007: Production Deployment

## Objectives
Deploy FastAPI backend to Fly.io with PostgreSQL, GitHub Actions for CI/CD, and preview deployments for PRs.

## Prerequisites
- All backend phases 001-006 completed and tested
- Fly.io account with CLI installed (`flyctl`)
- GitHub repository with secrets configured

## Key Requirements

### Production Configuration
- **Region**: EWR (US East - New Jersey)
- **Scaling**: Never scale to 0, autoscale up to 5 instances
- **Database**: PostgreSQL managed by Fly.io
- **Persistent Storage**: Volume mounted at `/app/media` for projects (production only)
- **Deployment Trigger**: Push to main/master branch

### Preview Configuration
- **Scaling**: Scale to 0 after inactivity, minimal resources (256MB RAM)
- **Database**: SQLite (simpler for ephemeral previews)
- **Storage**: Ephemeral (no volume mounting)
- **Cleanup**: Destroy app when PR closes
- **Naming**: `vibegrapher-api-pr-{number}`

### Docker Security
- Create non-root user for running application
- Use `USER` directive to switch from root
- Set proper file permissions for app directory
- Follow Fly.io best practices for container security

### GitHub Actions Requirements

#### Production Workflow
- Run integration tests before deployment
- Deploy only if tests pass
- Run Alembic migrations after deployment
- Health check verification
- Use `FLY_API_TOKEN` and `OPENAI_API_KEY` secrets

#### Preview Workflow  
- Create preview app with PR number in name
- Use SQLite database (no separate database needed)
- Comment on PR with preview URL
- Auto-destroy when PR closes
- Reuse existing preview if PR updated

### fly.toml Configuration Points
- `primary_region = "ewr"`
- `auto_stop_machines = false` (production) / `true` (preview)
- `min_machines_running = 1` (production) / `0` (preview)
- `force_https = true`
- Mount volume for media/projects (production only)

### Dockerfile Requirements
- Multi-stage build not required (simple app)
- Install system deps for pygit2
- Create non-root user (e.g., `appuser`)
- Switch to non-root user before running app
- Run migrations in CMD before starting server

### Health Check Endpoint
Create `/health` endpoint that:
- Checks database connectivity
- Returns region and version info
- Used by GitHub Actions to verify deployment

## Acceptance Criteria
- ✅ Production app deployed to Fly.io EWR region
- ✅ PostgreSQL database attached and migrations run automatically
- ✅ Never scales to 0 in production, auto-scales up to 5 instances
- ✅ GitHub Action deploys to prod on main/master push
- ✅ Preview deployments created for PRs (scale to 0, no volume)
- ✅ Preview apps destroyed when PR closed
- ✅ Health check endpoint returns database status
- ✅ Persistent storage mounted for media/projects (production only)
- ✅ HTTPS enforced on all endpoints
- ✅ Secrets properly configured (never in code)
- ✅ Non-root user runs application in container

## GitHub Secrets Required
```
FLY_API_TOKEN: (from fly auth token)
OPENAI_API_KEY: sk-...
```

## Fly.io Commands Reference
```bash
# Create PostgreSQL
fly postgres create --name vibegrapher-db --region ewr --initial-cluster-size 1

# Attach database (creates DATABASE_URL secret)
fly postgres attach vibegrapher-db --app vibegrapher-api

# Set secrets
fly secrets set OPENAI_API_KEY=sk-... --app vibegrapher-api

# Create volume (production only)
fly volumes create vibegrapher_data --size 10 --region ewr

# Check logs
fly logs --app vibegrapher-api

# SSH into container
fly ssh console --app vibegrapher-api
```

## Deliverables
- [ ] backend/fly.toml with production configuration
- [ ] backend/fly.preview.toml template for PR deployments  
- [ ] backend/Dockerfile with non-root user
- [ ] .github/workflows/deploy-backend-prod.yml
- [ ] .github/workflows/deploy-backend-preview.yml
- [ ] Health check endpoint in backend/app/api/health.py
- [ ] Updated config.py to handle DATABASE_URL from Fly.io
- [ ] Validation evidence in backend/validated_test_evidence/phase-007/