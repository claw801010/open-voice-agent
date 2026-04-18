# Dograh - Project Overview

Dograh is a voice AI platform for building and deploying conversational AI agents with telephony and WebRTC support.

## Fork documentation (FulliO / extended)

Beyond this overview, the repo includes a **documentation suite** for product tiers, strategy, and execution: [DOCS.md](DOCS.md) (map), [READMEEXPERIENCE.md](READMEEXPERIENCE.md) (no-code / builder / ADK), [READMEPLANNING.md](READMEPLANNING.md), [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md).

## Project Structure

```
dograh/
├── api/              # Backend - FastAPI application
├── ui/               # Frontend - Next.js application
├── scripts/          # Helper scripts for local development
├── docs/             # Mintlify documentation
├── pipecat/          # Pipecat framework (git submodule)
├── docker-compose.yaml       # Production/OSS deployment
├── docker-compose-local.yaml # Local development services
```

## Tech Stack

- **Backend**: Python with FastAPI
- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Database**: PostgreSQL with SQLAlchemy (async)
- **Cache/Queue**: Redis with ARQ for background tasks
- **Storage**: MinIO (S3-compatible) for audio files

## Local Development

### Starting Services

```bash
# Start infrastructure services (postgres, redis, minio)
./scripts/start_services_dev.sh

# Stop all services
./scripts/stop_services.sh
```

On Windows (PowerShell):
```powershell
.\scripts\start_services_dev.ps1
.\scripts\stop_services.ps1
```

## Environment Configuration

- `api/.env` - Backend environment variables
- `ui/.env` - Frontend environment variables
