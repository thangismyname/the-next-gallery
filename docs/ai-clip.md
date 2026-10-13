# Semantic Search + Zero-shot Classification — OpenCLIP

This document describes how OpenCLIP is used in the project, following the
method from **"Learning Transferable Visual Models From Natural Language
Supervision"** (Radford et al. 2021 — CLIP): images and text are projected into
the **same vector space**, and results come from **cosine similarity**.

## Architecture

```
frontend (Spotlight search)
   │  GET /api/gallery/media/search?q=...
   ▼
backend (Node)  media.service.js::searchMedia
   │  embedding.service.js::semanticSearch
   │  embedText(query) ── POST /api/v1/embed/text ──┐
   │  pgvector: 1 - (embedding <=> $q) >= threshold  │
   ▼                                               ├─ ai-service (FastAPI)
media_embeddings (Postgres + pgvector)             │  OpenCLIP ViT-B-32
   ▲                                               │  model weights baked into the image
   │  backfill / upload-time embedding ─────────────┘
```

- **Media embeddings**: `media_embeddings` table (512-dim vector, L2-normalized).
- **Query**: wrapped in the template `"a photo of a {query}"` (only when the query is short, ≤3 words).
- **Threshold**: only images with cosine similarity ≥ `AI_CLIP_MIN_SIM` (default `0.22`) are returned.

## 1. Backfill embeddings for existing images

If `media_embeddings` is empty (check `GET /api/gallery/media/embed/status`),
search only falls back to filename matching — **not semantic**. Run a backfill:

```bash
cd backend
npm run backfill:embed              # all users
npm run backfill:embed <userId>     # or a single user
```

Requires the ai-service to be running (embed/image + embed/text). Newly uploaded
images are embedded in the background automatically.

## 2. Zero-shot classification

Send one image + N labels → returns a softmax probability for each label
(cosine between image/text, multiplied by the model's learned `logit_scale`,
then softmax — the CLIP formula). Supports **prompt ensembling** like the paper
(averaging embeddings from multiple templates).

### HTTP

```bash
curl -X POST http://localhost:8000/api/v1/classify \
  -F 'file=@car.jpg' \
  -F 'labels=["car","dog","cat","boat"]' \
  -F 'templates=["a photo of a {}"]'
```

```json
{
  "provider": "open_clip",
  "model": "ViT-B-32",
  "dimension": 512,
  "templates": ["a photo of a {}"],
  "predictions": [
    { "label": "car",     "probability": 0.91, "similarity": 0.32 },
    { "label": "boat",    "probability": 0.05, "similarity": 0.18 },
    { "label": "dog",     "probability": 0.02, "similarity": 0.14 },
    { "label": "cat",     "probability": 0.02, "similarity": 0.13 }
  ]
}
```

## 3. Using the ai-service from an external Python file

### 3a. Call the HTTP API (server running)

Endpoints:

| Method | Path                  | Input                                    | Output |
|--------|-----------------------|------------------------------------------|--------|
| POST   | `/api/v1/embed/image` | multipart `file` (jpeg/png/webp/gif ≤10MB)| `EmbedResponse` |
| POST   | `/api/v1/embed/text`  | JSON `{ text }`                          | `EmbedResponse` |
| POST   | `/api/v1/classify`    | multipart `file` + `labels` + `templates` (JSON array of strings) | `ClassifyResponse` |
| GET    | `/api/v1/embed/info`  | —                                        | provider/model/dimension |

### 3b. CLI script `scripts/clip_demo.py`

```bash
cd ai-service

# HTTP (requires the server running on 8000)
python scripts/clip_demo.py info
python scripts/clip_demo.py embed-image path/to.jpg
python scripts/clip_demo.py embed-text "a red car"
python scripts/clip_demo.py classify path/to.jpg dog car cat
python scripts/clip_demo.py similarity path/to.jpg "a red car"

# Import the provider directly — no server needed (torch + model load in-process)
AI_EMBED_PROVIDER=open_clip python scripts/clip_demo.py --direct classify path/to.jpg dog car cat
```

### 3c. Import the provider in your own Python code

```python
# Run from the ai-service/ directory (PYTHONPATH includes app)
# Set beforehand: AI_EMBED_PROVIDER=open_clip (config reads ../.env or shell env)
from app.providers import get_embedding_provider

provider = get_embedding_provider()  # OpenClipEmbeddingProvider / StubEmbeddingProvider
print(provider.name, provider.model, provider.dimension)

img_vec = provider.encode_image(open("car.jpg", "rb").read())
txt_vec = provider.encode_text("a photo of a red car")
print(img_vec[:5])

preds = provider.classify(open("car.jpg", "rb").read(), ["dog", "car", "cat"])
print(preds)
```

> On first run on a host, OpenCLIP downloads weights to `$HOME/.cache/clip`
> (needs internet). In Docker the weights are baked into the image at
> `/opt/clip-cache` (`ENV HOME=/opt/clip-cache`).

## 4. App API (semantic search)

| Endpoint | Notes |
|----------|-------|
| `GET /api/gallery/media/search?q=` | Semantic first; returns a `score` (cosine) per image. Empty if below the threshold. Falls back to filename matching only when the user has **no embeddings yet** or the ai-service errors. |
| `GET /api/gallery/media/embed/status` | `{ total, embedded, pending }` |
| `POST /api/gallery/media/embed/backfill` | Backfill over HTTP (auth), max 200 per batch. |

## 5. Configuration

| Env | Default | Meaning |
|-----|---------|---------|
| `AI_EMBED_PROVIDER` | `stub` | `stub` (no model) / `open_clip` |
| `AI_CLIP_MODEL` / `AI_CLIP_PRETRAINED` | `ViT-B-32` / `laion2b_s34b_b79k` | OpenCLIP model |
| `AI_CLIP_DEVICE` | `auto` | `auto` (cuda>mps>cpu) / `cpu` |
| `AI_SERVICE_URL` (backend) | `http://localhost:8000` | Backend → ai-service |
| `AI_CLIP_MIN_SIM` (backend) | `0.22` | Default cosine threshold; `0` to disable |
