# Vibegrapher Backend Deployment Guide

## Overview

The Vibegrapher backend is deployed to Fly.io with the following configuration:
- **Production**: PostgreSQL database, persistent storage, auto-scaling
- **Preview**: SQLite database, ephemeral storage, scale to zero

## Prerequisites

1. Install Fly.io CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Authenticate with Fly.io:
```bash
fly auth login
```

3. Set up GitHub Secrets:
- `FLY_API_TOKEN`: Get from `fly auth token`
- `OPENAI_API_KEY`: Your OpenAI API key

## Production Deployment

### Initial Setup

1. Create the Fly.io app:
```bash
cd backend
fly apps create vibegrapher-api --org personal
```

2. Create PostgreSQL database:
```bash
fly postgres create --name vibegrapher-db --region ewr --initial-cluster-size 1
fly postgres attach vibegrapher-db --app vibegrapher-api
```

3. Create persistent volume for media storage:
```bash
fly volumes create vibegrapher_data --size 10 --region ewr --app vibegrapher-api
```

4. Set secrets:
```bash
fly secrets set OPENAI_API_KEY=sk-your-key-here --app vibegrapher-api
```

5. Deploy:
```bash
fly deploy --app vibegrapher-api
```

### Automatic Deployment

Push to `main` or `master` branch triggers automatic deployment via GitHub Actions:
- Runs integration tests
- Deploys if tests pass
- Runs database migrations
- Health check verification
- Automatic rollback on failure

### Manual Deployment

```bash
cd backend
fly deploy --app vibegrapher-api
```

## Preview Deployments

Preview environments are automatically created for pull requests:
- App name: `vibegrapher-api-pr-{number}`
- Uses SQLite database
- Scales to zero when inactive
- Automatically destroyed when PR is closed

### Manual Preview Creation

```bash
# Create preview app
fly apps create vibegrapher-api-pr-123 --org personal

# Set secrets
fly secrets set \
  OPENAI_API_KEY=sk-your-key \
  DATABASE_URL="sqlite:///./preview.db" \
  ENVIRONMENT=preview \
  --app vibegrapher-api-pr-123

# Deploy with preview config
fly deploy --app vibegrapher-api-pr-123 --config fly.preview.toml
```

## Monitoring & Debugging

### View Logs
```bash
fly logs --app vibegrapher-api
```

### SSH into Container
```bash
fly ssh console --app vibegrapher-api
```

### Health Check
```bash
# Basic health check
curl https://vibegrapher-api.fly.dev/health

# Detailed health check
curl https://vibegrapher-api.fly.dev/health/detailed
```

### Database Access
```bash
# Connect to PostgreSQL
fly postgres connect -a vibegrapher-db

# Run SQL commands
fly postgres connect -a vibegrapher-db -c "SELECT COUNT(*) FROM projects;"
```

### View Metrics
```bash
fly dashboard --app vibegrapher-api
```

## Environment Variables

Production environment variables are managed via Fly.io secrets:

| Variable | Description | Set By |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL connection string | Fly.io (automatic) |
| `OPENAI_API_KEY` | OpenAI API key | Manual |
| `ENVIRONMENT` | `production`, `preview`, or `development` | fly.toml |
| `FLY_REGION` | Deployment region | Fly.io (automatic) |
| `FLY_APP_NAME` | Application name | Fly.io (automatic) |

## Scaling Configuration

### Production
- **Min instances**: 1 (never scales to 0)
- **Max instances**: 5 (auto-scales based on load)
- **Memory**: 512MB
- **CPU**: 1 shared CPU

### Preview
- **Min instances**: 0 (scales to 0 when inactive)
- **Max instances**: 1
- **Memory**: 256MB
- **CPU**: 1 shared CPU

## Database Migrations

Migrations run automatically on deployment. To run manually:

```bash
# Production
fly ssh console -C "alembic upgrade head" --app vibegrapher-api

# Create new migration
fly ssh console -C "alembic revision --autogenerate -m 'description'" --app vibegrapher-api
```

## Rollback Procedure

### Automatic Rollback
GitHub Actions automatically rolls back on deployment failure.

### Manual Rollback
```bash
# List releases
fly releases list --app vibegrapher-api

# Rollback to specific version
fly deploy --image-label v123 --app vibegrapher-api
```

## Security Notes

1. **Non-root User**: Application runs as `appuser` (UID 1000)
2. **HTTPS Only**: All traffic forced to HTTPS
3. **Secrets Management**: Never commit secrets to code
4. **Health Checks**: Regular health checks ensure app stability

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check database status
   fly postgres list
   # Restart database if needed
   fly postgres restart -a vibegrapher-db
   ```

2. **Out of Memory**
   ```bash
   # Scale up memory
   fly scale memory 1024 --app vibegrapher-api
   ```

3. **Deployment Stuck**
   ```bash
   # Check build logs
   fly logs --app vibegrapher-api
   # Force new deployment
   fly deploy --force --app vibegrapher-api
   ```

4. **Volume Issues**
   ```bash
   # List volumes
   fly volumes list --app vibegrapher-api
   # Extend volume if full
   fly volumes extend vol_xxx --size 20 --app vibegrapher-api
   ```

## Cost Estimation

Based on Fly.io pricing (as of 2024):
- **Shared CPU**: ~$5/month per instance
- **512MB RAM**: Included in shared CPU
- **PostgreSQL**: ~$5/month for development tier
- **Storage**: $0.15/GB/month
- **Bandwidth**: First 160GB free

**Estimated Total**: ~$15-20/month for production

## CI/CD Workflows

### Production Deployment (`deploy-backend-prod.yml`)
- Triggers on push to main/master
- Runs integration tests
- Deploys to production
- Runs migrations
- Health check verification

### Preview Deployment (`deploy-backend-preview.yml`)
- Triggers on PR open/update
- Creates preview environment
- Comments on PR with URL
- Uses SQLite for simplicity

### Preview Cleanup (`cleanup-preview.yml`)
- Triggers on PR close
- Destroys preview app
- Comments confirmation on PR

## Support

For deployment issues:
1. Check Fly.io status: https://status.fly.io
2. Review logs: `fly logs --app vibegrapher-api`
3. Check health endpoint: `curl https://vibegrapher-api.fly.dev/health/detailed`
4. Contact Fly.io support if needed