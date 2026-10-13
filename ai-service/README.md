# ai-service — The Next Gallery AI Service

A **Python FastAPI** microservice handling hand-gesture recognition
(GestureRecognizer), **facial expression** recognition (FaceLandmarker +
blendshapes), **CLIP (OpenCLIP) embeddings** for **semantic search**, and
**YOLO26 object detection**.

## Run locally

```bash
cd ai-service

# 1. Install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Install models (run once) — only needed when using the mediapipe provider
python scripts/download_model.py --task all          # gesture + face

# 3. Enable the mediapipe provider once models exist (default is stub)
# Put in .env (project root): AI_GESTURE_PROVIDER=mediapipe  AI_FACE_PROVIDER=mediapipe

# 4. Run
uvicorn app.main:app --reload --port 8000
```

> ⚠️ mediapipe **MUST be 0.10.x** (requirements.txt pins `<0.11`) and Python
> **≤3.12**. 1.0.x aborts on macOS-arm64 (`DrishtiMetalHelper` / "Check failed:
> service_ Service is unavailable", even with the CPU delegate). A local Python
> 3.14 can't install 0.10.x → use Docker (python:3.12) or keep `stub`.

API docs: http://localhost:8000/docs

## Endpoints

| Method | Path              | Description                                     |
|--------|-------------------|-------------------------------------------------|
| GET    | `/health`         | Health check + active providers                  |
| POST   | `/api/v1/detect`  | Image file → `DetectResponse` (hand + face)      |
| POST   | `/api/v1/detect/objects` | Image file → `ObjectDetectResponse` (YOLO26) |
| POST   | `/api/v1/embed/image` | Image file → embedding vector (CLIP image encoder) |
| POST   | `/api/v1/embed/text`  | `{ "text": "..." }` → embedding vector (CLIP text encoder) |
| POST   | `/api/v1/classify`    | Image + labels → zero-shot softmax probabilities (CLIP) |
| GET    | `/api/v1/embed/info`  | Embedding provider info (provider/model/dimension) |
| GET    | `/`               | Service info                               |

### POST /api/v1/detect

Request: multipart/form-data, field `file` (JPEG/PNG/WebP/GIF, max 10MB).

Response (unified):
```json
{
  "provider": "mediapipe",
  "hand": {
    "detected": true,
    "label": "Thumb_Up",
    "confidence": 0.92,
    "gestures": [
      { "label": "Thumb_Up", "confidence": 0.92 },
      { "label": "Closed_Fist", "confidence": 0.03 }
    ]
  },
  "face": {
    "detected": true,
    "expression": "smile",
    "confidence": 0.87,
    "faces": 1
  }
}
```

- Hand gestures (7 classes + None): `Closed_Fist`, `Open_Palm`, `Pointing_Up`,
  `Thumb_Down`, `Thumb_Up`, `Victory`, `ILoveYou`.
- Face expressions: `smile`, `laugh`, `surprised`, `wink`, `angry`, `sad`, `neutral`
  (mapped from FaceLandmarker's 52 ARKit blendshapes).

### POST /api/v1/detect/objects

Request: multipart/form-data, field `file` (image, max 10MB).

```json
{
  "provider": "yolo",
  "model": "yolo26n",
  "detections": [
    { "class_name": "dog", "confidence": 0.88, "bbox": [0.03, 0.42, 0.85, 0.94] }
  ]
}
```

`bbox` is `[x1, y1, x2, y2]` normalized to 0–1. See `docs/ai-yolo.md`.

### POST /api/v1/embed/image & /api/v1/embed/text

`embed/image`: multipart/form-data, field `file` (JPEG/PNG/WebP/GIF, max 10MB).
`embed/text`: JSON `{ "text": "dog running on the beach" }` (1–500 chars).

Response (both):
```json
{
  "provider": "open_clip",
  "model": "ViT-B-32",
  "dimension": 512,
  "embedding": [0.013, -0.021, "..."]
}
```

Vectors are L2-normalized. The backend stores image embeddings in the
`media_embeddings` table (pgvector) and uses `1 - (embedding <=> $query)`
(cosine) to find images by description. See `docs/ai-clip.md`.

## Providers (plugin pattern)

`app/providers/` — four groups: **Gesture** implements `GestureProvider`,
**Face** implements `FaceProvider`, **Embedding** implements `EmbeddingProvider`,
**Object detection** implements `ObjectDetectionProvider`. Registered in
`app/providers/__init__.py::get_gesture_provider()` / `get_face_provider()` /
`get_embedding_provider()` / `get_object_provider()`.

| Provider          | Requirement                                   | Description                            |
|-------------------|-----------------------------------------------|----------------------------------------|
| `stub`            | none                                          | Gesture/face return `detected=false`, objects return `[]`; embedding returns a deterministic (unit-norm) vector — runs the skeleton |
| `mediapipe`       | `pip install mediapipe` + model tasks (`scripts/download_model.py`) | Hand: GestureRecognizer; Face: FaceLandmarker |
| `open_clip`       | `pip install torch torchvision open_clip_torch` | OpenCLIP image/text encoder for semantic search |
| `yolo`            | `pip install ultralytics` + weights (`scripts/download_yolo_weight.py`) | YOLO26 object detection |

To add your own provider: create a class following the matching ABC, add a branch
in the factory, and set `AI_GESTURE_PROVIDER`/`AI_FACE_PROVIDER`/`AI_EMBED_PROVIDER`/`AI_OBJECT_PROVIDER=<name>`.

## Env vars

Prefix `AI_` (read from env or the project-root `.env` — same convention as the backend):

| Variable               | Default                     | Meaning                    |
|------------------------|-----------------------------|----------------------------|
| `AI_HOST`              | `0.0.0.0`                   | Bind host                  |
| `AI_PORT`              | `8000`                      | Port                       |
| `AI_GESTURE_PROVIDER`  | `stub`                      | `stub` \| `mediapipe`      |
| `AI_FACE_PROVIDER`     | `stub`                      | `stub` \| `mediapipe`      |
| `AI_EMBED_PROVIDER`    | `stub`                      | `stub` \| `open_clip`      |
| `AI_OBJECT_PROVIDER`   | `stub`                      | `stub` \| `yolo`           |
| `AI_CLIP_MODEL`        | `ViT-B-32`                  | OpenCLIP model name        |
| `AI_CLIP_PRETRAINED`   | `laion2b_s34b_b79k`         | Pretrained tag             |
| `AI_CLIP_DEVICE`       | `auto`                      | `auto` \| `cpu` \| `cuda` \| `mps` |
| `AI_YOLO_WEIGHTS`      | `yolo26n.pt`                | YOLO weights path          |
| `AI_YOLO_DEVICE`       | `auto`                      | `auto` \| `cpu` \| `cuda` \| `mps` |
| `AI_YOLO_CONF`         | `0.25`                      | YOLO confidence threshold  |
| `AI_MODEL_DIR`         | `models`                    | Gesture model directory    |
| `AI_FACE_MODEL_DIR`    | `models`                    | Face model directory       |
| `AI_CORS_ORIGINS`      | `["http://localhost:5173"]` | CORS origins for the web FE |

## Docker

```bash
# Dev — only ai-service (the Docker build downloads models + mediapipe 0.10.x)
docker compose -f docker-compose.dev.yml --env-file .env up ai-service

# Prod (with the whole stack)
docker compose -f docker-compose.prod.yml --env-file .env up -d ai-service
```

Inside the Docker network the backend reaches it at `http://ai-service:8000`
(internal, not exposed to the host). `docker-compose.dev.yml`/`prod.yml` allow
overriding the providers via the `AI_GESTURE_PROVIDER`/`AI_FACE_PROVIDER`/
`AI_EMBED_PROVIDER`/`AI_OBJECT_PROVIDER` env vars.

> Dev `--profile full` enables `AI_EMBED_PROVIDER=open_clip` by default (torch is
> in the image). Prod defaults to `stub` — set `AI_EMBED_PROVIDER=open_clip` in
> `.env` to enable semantic search. OpenCLIP weights (~350MB) are downloaded to
> the cache on the first embed.
