# The Next Gallery

An AI-powered gallery web app for managing, organizing, and sharing photos and
videos — with semantic search, object detection, Locket-style moments, and
serverless P2P sharing.

## Overview

The Next Gallery is a full-stack platform that combines classic media management
(upload, albums, favorites, trash) with modern social and peer-to-peer features,
plus an AI layer for content-based search.

- **Browse** — an infinite-scroll gallery backed by WebP thumbnails and
  high-performance streaming (ETag / range requests, immutable cache).
- **Search** — find images by meaning ("sunset on the beach") with OpenCLIP
  embeddings + pgvector, or by the objects they contain with YOLO26 detection.
- **Share** — send full-resolution files directly device-to-device over WebRTC,
  so the server never stores the transferred content.
- **Moments** — ephemeral, Locket-style posts shared with a friend circle,
  including collaborative templates and a meme wall.

## Features

**Media**
- Upload photos/videos with WebP thumbnails (EXIF rotation)
- High-performance streaming (ETag / 304, HTTP range for video, immutable cache)
- Infinite-scroll gallery, favorites, trash (soft delete + permanent), multi-select

**Social**
- **Moments** — ephemeral friend feed with collaboration templates
  (`single`, `duo_square`, `trio_wide`) and emoji reactions
- **Meme wall** — attach memes to a moment (rendered via memegen.link) with heart reactions
- **Friends** — friend circle, requests, and invite links

**Sharing**
- **P2P Share (WebRTC)** — send files directly device-to-device over WebSocket
  signaling + WebRTC DataChannel; QR / room code / friends / LAN, multi-file and
  multi-receiver. The server never stores transferred files.

**AI**
- **Semantic search** — search by description using OpenCLIP embeddings + pgvector
  cosine similarity
- **Object search** — search by object (YOLO26), with bounding-box overlay in Developer Mode
- Zero-shot classification endpoint, plus backfill scripts for existing media

**Platform**
- **Capture** — in-browser camera capture
- **Albums** — album API and album search
- **Developer Mode** — request → admin approval; enables the detection bbox overlay
- **Admin dashboard** — stats, user management, developer request review
- Auth (email/password, Google, GitHub), i18n (Vietnamese default, English), dark mode, responsive

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, react-router, Framer Motion |
| Backend | Node.js 20 (ES Modules), Express, Better Auth, `pg`, `sharp`, `multer`, `ws` |
| AI service | Python FastAPI, OpenCLIP (ViT-B-32), YOLO26 (ultralytics), MediaPipe |
| Data | PostgreSQL 16 + pgvector, MinIO (S3-compatible) |
| Infra | Docker + Docker Compose, Caddy (prod reverse proxy), Nginx |

## Project structure

```
The_Next_Gallery/
├── backend/          Express API, WebSocket signaling, media/AI services
├── frontend/         React SPA (features/*: gallery, moments, share, search, admin)
├── ai-service/       FastAPI microservice (embeddings, detection, classify)
├── database/pipeline/  PostgreSQL schema (schema.sql, schema.dbml)
└── docs/             Proposal, AI docs, feature specs, setup guide
```

## Documentation

- [**Setup guide**](docs/setup.md) — requirements, environment, running locally and in Docker
- [`AGENTS.md`](AGENTS.md) — architecture, conventions, feature status
- [`docs/proposal.md`](docs/proposal.md) — project proposal
- [`docs/ai-clip.md`](docs/ai-clip.md) — semantic search + zero-shot classification
- [`docs/ai-yolo.md`](docs/ai-yolo.md) — YOLO26 object detection
- [`docs/features/share-p2p.md`](docs/features/share-p2p.md) — P2P sharing spec
- [`ai-service/README.md`](ai-service/README.md) — AI microservice

## Requirements

Docker (PostgreSQL + MinIO) · Node.js 20+ · Python 3.11–3.12 (only to run the AI
service natively). See the [setup guide](docs/setup.md) for details.

## Quick start

See the [setup guide](docs/setup.md). In short:

```bash
cp .env.example .env                                   # fill in the [REQUIRED] values
ln -s ../.env backend/.env                             # so the Better Auth CLI can read it
docker compose -f docker-compose.dev.yml --env-file .env up -d postgres minio
cd backend && npm install && npx @better-auth/cli migrate && npm run dev
cd ../frontend && npm install && npm run dev           # http://localhost:5173
```

## License

Released under the [MIT License](LICENSE).
