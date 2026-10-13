# The Next Gallery — Project Proposal

An AI-powered gallery web application for managing, organizing, and sharing
photos and videos.

## 1. Overview

**The Next Gallery** is a full-stack gallery platform that combines classic
media management (albums, favorites, trash) with modern social and
peer-to-peer sharing, and an AI-driven experience (semantic search and object
detection). The project targets a single, coherent product spanning web, with
an API designed so a mobile client (Flutter) can reuse the same backend.

**Goal:** build a gallery that is not just storage, but a smart, social, and
bandwidth-efficient way to keep and move memories.

## 2. Tech Stack

### Backend
- **Runtime:** Node.js 20 (ES Modules)
- **Framework:** Express 4.x, plain JavaScript with TypeScript type-checking via `tsx`
- **Auth:** Better Auth v1.7 — email/password + Google + GitHub OAuth, admin plugin
- **Database:** PostgreSQL 16 with pgvector (`pg` driver)
- **Object Storage:** MinIO (S3-compatible)
- **Image Processing:** sharp (WebP thumbnails, EXIF rotation)
- **Media Streaming:** cached thumbnail/file endpoints (ETag, `Accept-Ranges`, immutable caching)
- **Upload:** multer (memory storage)
- **Email:** nodemailer (password reset)
- **Security:** helmet, CORS
- **Realtime:** `ws` (WebSocket signaling)

### Frontend
- **Framework:** React 19 + Vite
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Routing:** react-router-dom v7
- **State:** Zustand
- **Animation:** Framer Motion
- **i18n:** i18next (Vietnamese default, English)
- **Theme:** next-themes (light/dark/system)
- **Linter:** oxlint

### AI Service
- **Framework:** Python FastAPI microservice
- **Vision:** OpenCLIP embeddings (semantic search, zero-shot classification) + YOLO26 object detection

### Infrastructure
- Docker + Docker Compose (dev and prod)
- Caddy 2 (production reverse proxy), Nginx (frontend static files)
- PostgreSQL 16 (pgvector image), MinIO

## 3. User Roles

The system defines **three system-level roles** and a finer-grained
**album-level role** layer.

### 3.1 System-level roles

| # | Role | Description |
|---|------|-------------|
| 1 | **Guest (unauthenticated)** | Can open public share links (`/s/{token}`) and receive peer-to-peer transfers over LAN/hotspot without creating an account. Cannot own media, albums, or moments. |
| 2 | **Registered User** | Owns media, creates and manages albums, posts moments, maintains a friend circle, and sends/receives P2P file transfers. Default role (`user`). |
| 3 | **Admin** | Full platform oversight: user management (ban/unban), system statistics and dashboard, via `/api/admin/*`. Role `admin`. |

### 3.2 Album-level roles

Album collaboration uses roles stored per membership (`album_members.role`):

| Role | Permissions |
|------|-------------|
| **Owner** | Full control: edit/delete album, manage members, create share links. |
| **Editor** | Add and remove media, edit album contents. |
| **Viewer** | Read-only access to album media. |

This separation allows ownership (system role) and collaboration permissions
(album role) to be decided independently — a registered user can be merely a
`viewer` in someone else's album.

## 4. Main Entities

### Identity (managed by Better Auth)
- **user** — account record; carries `role` and moderation fields (`banned`,
  `banReason`, `banExpires`) from the admin plugin.
- **session** — active login sessions.
- **account** — linked auth providers (credential, Google, GitHub).
- **verification** — verification tokens (email, password reset).

### Media core
- **media** — the central "source of truth" for every uploaded photo/video
  (storage keys, dimensions, video metadata, soft-delete, favorite flag). All
  other entities reference `media.id` instead of duplicating file info.

### Organization
- **albums** — user-owned collections (name, description, cover media).
- **album_media** — n-n join between albums and media (with display order).
- **album_members** — n-n collaboration: users (other than the owner) granted
  access to an album, with role and invitation state.
- **share_links** — public token-based links that require no account; each link
  targets either an album or a single media item, with permission/expiry/view
  limits.

### Social
- **friendships** — a friend circle represented as a single bidirectional row
  per pair (requester, addressee, status), used to decide moment visibility.

### Moments (Locket-style ephemeral sharing)
- **moments** — a fast post shared with the friend circle, with templates
  (`single`, `duo_square`, `trio_wide`) and visibility/expiry.
- **moment_collab** — per-user image slots for multi-user templates; a moment
  becomes visible once all slots are filled.
- **moment_reactions** — one emoji reaction per user per moment.
- **moment_memes** — memes attached to a moment (the flip-side "meme wall").
- **meme_reactions** — heart reactions on individual memes.

### P2P Sharing
- **share_sessions** — a P2P transfer session with a short room code, host,
  target media list, transfer mode, and expiry.
- **share_session_receivers** — each receiver in a session, with individual
  status and received-file tracking (supports multi-receiver and resume).

## 5. Advanced Features

Beyond the core gallery (upload, albums, infinite-scroll browsing, trash,
favorites, high-performance streaming), the project builds **three advanced
features**:

### 5.1 AI Visual Semantic Search
Content-based search over photos using OpenCLIP image embeddings and YOLO
object detection. Users can search by meaning and content ("sunset on the
beach", "my dog") instead of filename. Image embeddings are stored in `pgvector`
and queried with cosine similarity, and object detections power object search
and a bounding-box overlay in Developer Mode.

**Why it's advanced:** combines multimodal embeddings, vector similarity search
(pgvector), and object detection into a unified retrieval experience — well
beyond keyword matching.

### 5.2 Peer-to-Peer Media Transfer (WebRTC)
Direct, server-bypassing transfer of full-resolution photos/videos using
WebSocket signaling + WebRTC DataChannels. Supports three modes:

| Mode | Transport | Server bandwidth |
|------|-----------|------------------|
| Internet | WebRTC (STUN/TURN) | None |
| Same-WiFi LAN | WebRTC (empty ICE servers) | None |
| WiFi Hotspot (offline) | WebRTC over local network | None |

Features: QR-code / short-code pairing, friend-based invites, multi-file,
multi-receiver, and optional "save to gallery" (media bytes only reach the
server if the receiver chooses to persist them).

**Why it's advanced:** real-time signaling, NAT traversal, and chunked binary
DataChannel framing — the server never stores the transferred content.

### 5.3 Interactive Moments with Collaborative Templates & Meme Reactions
Ephemeral, friend-circle sharing in the style of Locket. Multi-user collage
templates assemble automatically when all participants fill their slots
(`duo_square` = 2 people, `trio_wide` = 3 people). Each moment supports emoji
reactions and a flip-side "meme wall" with heart reactions.

**Why it's advanced:** collaborative asynchronous state (a moment only
publishes when all slots are filled), template-based composition, real-time
friend-circle visibility, and a social interaction layer — going beyond static
photo storage.

## 6. Scope & Status

All features described above are implemented:

- **Core media:** upload, WebP thumbnails, high-performance streaming,
  infinite-scroll gallery, favorites, trash.
- **Organization & social:** albums, friends, moments (templates + meme wall).
- **P2P sharing:** WebRTC signaling and transfer, QR / friends / LAN modes.
- **AI:** OpenCLIP semantic search and YOLO26 object detection.

## 7. Deliverables

1. A deployed full-stack gallery web application (React + Express + PostgreSQL + MinIO).
2. A documented REST + WebSocket API reusable by a future mobile client.
3. The three advanced features described above.
4. Source code, database schema, and technical documentation.
