# Frontend Phase 009: Production Deployment

## Objectives
Deploy React frontend to Fly.io as a static site with NGINX, GitHub Actions for CI/CD, and preview deployments for PRs.

## Prerequisites
- All frontend phases 001-008 completed and tested
- Backend deployed and accessible (phase 006)
- Fly.io account with CLI installed (`flyctl`)
- GitHub repository with secrets configured

## Key Requirements

### Production Configuration
- **Region**: EWR (US East - New Jersey, same as backend)
- **Scaling**: Never scale to 0, autoscale up to 3 instances
- **Serving**: NGINX for static files with SPA routing
- **Build**: Multi-stage Docker build for optimization
- **Deployment Trigger**: Push to main/master branch

### Preview Configuration
- **Scaling**: Scale to 0 after inactivity, minimal resources (128MB RAM)
- **Naming**: `vibegrapher-web-pr-{number}`
- **API URL**: Use preview backend if exists, else production
- **Cleanup**: Destroy app when PR closes

### Docker Requirements
- Multi-stage build (Node for building, NGINX for serving)
- Create non-root user in NGINX stage
- Build with `VITE_API_URL` as build argument
- Optimize bundle with code splitting
- Enable gzip compression in NGINX

### NGINX Configuration
- SPA routing (all routes to index.html)
- Cache static assets (1 year for JS/CSS with hash)
- Security headers (X-Frame-Options, etc.)
- Health check endpoint at `/health`
- Gzip compression for text assets

### GitHub Actions Requirements

#### Production Workflow
- Run tests and type checking before build
- Build with production API URL
- Deploy only if tests pass
- Run Lighthouse CI after deployment
- Comment with Lighthouse scores

#### Preview Workflow
- Build with preview backend URL if available
- Create app with PR number in name
- Comment on PR with preview URL
- Update existing preview on PR sync
- Auto-destroy when PR closes

### fly.toml Configuration Points
- `primary_region = "ewr"`
- `auto_stop_machines = false` (production) / `true` (preview)
- `min_machines_running = 1` (production) / `0` (preview)
- `force_https = true`
- No volume needed (static files only)

### Build Optimizations
- Bundle splitting for vendor code
- Separate chunks for Monaco editor
- Tree shaking and minification
- Source maps for production debugging
- PWA support (optional)

## Acceptance Criteria
- ✅ Production app deployed to Fly.io EWR region
- ✅ Static files served via NGINX with proper caching
- ✅ Never scales to 0 in production, auto-scales up to 3 instances
- ✅ GitHub Action deploys to prod on main/master push
- ✅ Preview deployments created for PRs (scale to 0)
- ✅ Preview apps destroyed when PR closed
- ✅ SPA routing works correctly (all routes to index.html)
- ✅ HTTPS enforced on all endpoints
- ✅ Lighthouse score > 90 for performance
- ✅ Bundle size < 500KB (gzipped)
- ✅ Non-root user runs NGINX in container

## GitHub Secrets Required
```
FLY_API_TOKEN: (from fly auth token)
```

## Environment Variables
- `VITE_API_URL`: Backend URL (build-time variable)
- `VITE_WS_URL`: WebSocket URL (defaults to API URL)

## Fly.io Commands Reference
```bash
# Launch app
fly launch --name vibegrapher-web --region ewr

# Deploy with build args
fly deploy --build-arg VITE_API_URL=https://vibegrapher-api.fly.dev

# Check status
fly status --app vibegrapher-web

# View logs
fly logs --app vibegrapher-web
```

## Deliverables
- [ ] frontend/Dockerfile with multi-stage build and non-root user
- [ ] frontend/nginx.conf for SPA routing
- [ ] frontend/fly.toml with production configuration
- [ ] frontend/fly.preview.toml template for PR deployments
- [ ] .github/workflows/deploy-frontend-prod.yml
- [ ] .github/workflows/deploy-frontend-preview.yml
- [ ] Vite config with build optimizations
- [ ] Validation evidence in frontend/validated_test_evidence/phase-009/