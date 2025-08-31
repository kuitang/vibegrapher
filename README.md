# Vibegrapher

A real-time collaborative coding platform using AI agents for code generation and evaluation.

## Prerequisites

- Python 3.8+
- Node.js 18+
- Git

## IMPORTANT: Environment Setup

**You must use virtualenv in backend/.venv and nvm to run node 22. Check these before attempting to start servers!**

```bash
# Backend: Check/create virtualenv
cd backend
python -m venv .venv
source .venv/bin/activate  # On macOS/Linux
# .venv\Scripts\activate   # On Windows

# Frontend: Check/use Node 22 with nvm
nvm list  # Check installed versions
nvm install 22  # Install if needed
nvm use 22  # Switch to Node 22
```

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Activate virtualenv (REQUIRED)
source .venv/bin/activate  # On macOS/Linux
# .venv\Scripts\activate   # On Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env  # Edit .env with your OPENAI_API_KEY

# Initialize database
alembic upgrade head

# Start backend server (accessible from kui-vibes)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be available at:
- Local: http://localhost:8000
- Network: http://kui-vibes:8000

### 2. Frontend Setup

```bash
cd frontend

# Ensure Node 22 is active (REQUIRED)
nvm use 22

# Install dependencies
npm install

# Start development server (accessible from kui-vibes)
npm run dev -- --host 0.0.0.0
```

Frontend will be available at:
- Local: http://localhost:5173
- Network: http://kui-vibes:5173

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run specific test phase
pytest tests/integration/test_phase001_infrastructure.py
```

### Frontend Tests

```bash
cd frontend

# Unit tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint

# E2E tests (requires both backend and frontend running)
npx playwright test

# E2E with UI mode
npx playwright test --ui
```

## Production Deployment

### Backend Deployment (Fly.io)

```bash
cd backend

# Login to Fly.io
fly auth login

# Deploy to production
fly deploy --app vibegrapher-api

# View logs
fly logs --app vibegrapher-api

# SSH into container
fly ssh console --app vibegrapher-api
```

### Frontend Deployment

```bash
cd frontend

# Build production bundle
npm run build

# Deploy dist/ folder to your static hosting service
```

## Environment Variables

### Backend (.env)
```bash
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL=sqlite:///./vibegrapher.db
CORS_ORIGINS=*
PORT=8000
```

### Frontend
Frontend automatically connects to backend at http://kui-vibes:8000 in development.

## Architecture Overview

- **Backend**: FastAPI + SQLAlchemy + Socket.io for real-time updates
- **Frontend**: React + TypeScript + Vite with Monaco Editor
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Real-time**: Socket.io for streaming AI responses
- **AI**: OpenAI Agents SDK for code generation

## API Documentation

Once backend is running:
- Swagger UI: http://kui-vibes:8000/docs
- ReDoc: http://kui-vibes:8000/redoc

## Health Checks

- Basic: http://kui-vibes:8000/health
- Detailed: http://kui-vibes:8000/health/detailed

## Common Issues

### Port Already in Use
```bash
# Kill existing process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill existing process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Database Migrations
```bash
cd backend

# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

### Frontend Can't Connect to Backend
Ensure backend is running on 0.0.0.0:8000, not just localhost:8000.

### Socket.io Connection Issues
Check CORS settings in backend .env file. For development, use `CORS_ORIGINS=*`.

## License

MIT