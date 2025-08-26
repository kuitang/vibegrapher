# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vibegrapher is a full-stack application for vibecoding OpenAI Agents SDK workflows via natural language. It consists of:
- **Backend**: FastAPI + SQLAlchemy + Socket.io for real-time updates
- **Frontend**: React + TypeScript + Vite with Monaco Editor for code display

## Commands

### Backend (from `/backend` directory)
```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest tests/

# Run specific test file
pytest tests/integration/test_phase001_infrastructure.py

# Format code
black app/
isort app/

# Type checking
mypy app/

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
```

### Frontend (from `/frontend` directory)
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run unit tests
npm test

# Run E2E tests (requires frontend and backend running)
npx playwright test

# Run specific E2E test
npx playwright test tests/e2e/vibegrapher-full.spec.ts
```

## Architecture

### Backend Architecture
- **FastAPI Application** (`backend/app/main.py`): Main application with CORS, routers, and exception handling
- **Database Models** (`backend/app/models/`): SQLAlchemy models for Project, VibecodeSession, ConversationMessage, Diff
- **API Routers** (`backend/app/api/`): RESTful endpoints for projects, sessions, diffs, tests
- **Services** (`backend/app/services/`):
  - `vibecode_service.py`: Orchestrates VibeCoder and Evaluator agents
  - `socketio_service.py`: Manages Socket.io real-time connections
  - `git_service.py`: Git operations using pygit2
- **Agents** (`backend/app/agents/all_agents.py`): OpenAI Agents SDK integration

### Frontend Architecture
- **Main App** (`frontend/src/App.tsx`): React Router setup with QueryClient
- **Pages** (`frontend/src/pages/`): HomePage (project list) and ProjectPage (vibecoding interface)
- **Components** (`frontend/src/components/`):
  - `VibecodePanel.tsx`: Chat interface for vibecoding
  - `CodeViewer.tsx`: Monaco Editor for code display
  - `DiffViewer.tsx`: Diff review and approval interface
- **State Management** (`frontend/src/store/`): Zustand store for session and UI state
- **Hooks** (`frontend/src/hooks/`):
  - `useSocketIO.ts`: Socket.io connection management
  - `useProjects.ts`: React Query hooks for API data
- **UI Components** (`frontend/src/components/ui/`): shadcn/ui components

### Key Data Flow
1. User sends message via VibecodePanel → POST to `/sessions/{id}/messages`
2. Backend starts async vibecode process, returns immediately
3. Real-time updates stream via Socket.io events:
   - `vibecode_started`: Process begins
   - `vibecode_streaming`: Token-by-token AI response
   - `vibecode_completed`: Success with diff
   - `vibecode_failed`: Error occurred
4. Frontend updates UI based on Socket.io events
5. User can approve/reject diffs via DiffReviewModal

### Database Schema
- Projects have unique slugs (generated from name)
- Sessions link to projects and contain conversation history
- Diffs store code changes with patches and commit messages
- All operations use SQLite in dev, PostgreSQL in production

## Testing Strategy
- Backend: pytest with async support, integration tests hit real database
- Frontend: Vitest for unit tests, Playwright for E2E tests
- **Important**: Frontend tests must hit real backend (no mocking)
- Test evidence collected in `validated_test_evidence/` directories

## Deployment
- Backend: Docker + fly.io with PostgreSQL
- Frontend: Vite build → static hosting
- Socket.io requires sticky sessions in production