# Object Detection — YOLO26

This document describes the **object detection (YOLO26)** pipeline in the
project: detecting objects in images at upload time (in the background),
backfilling existing images, searching images by **object** in Spotlight search,
and drawing **bounding boxes** in Developer Mode.

Default model: **YOLO26n** (`yolo26n.pt`, ultralytics) — 80 COCO classes, ~2.4M
params, weights ~5.3MB. Returns class + confidence + a normalized 0–1 bbox.

## Architecture

```
image upload ──► media.service.js::uploadMedia
                   │  detection.service.js::detectMediaInBackground  (fire-and-forget)
                   ▼
               POST /api/v1/detect/objects ─────► ai-service (FastAPI)
                   │                                 YOLO26 provider
                   ▼
               media_detections (Postgres)
                   │
   ┌──────────────┼─────────────────────────┐
   ▼              ▼                          ▼
 Spotlight search  Developer Mode        (re-run when needed)
 objects/search    /:id/detections        backfill:detect
```

- `media_detections` table: each image has **many** rows (many objects), storing
  `class_name`, `confidence`, `bbox` (`REAL[]` `[x1,y1,x2,y2]` normalized 0–1),
  and `model`. Deleting media deletes detections (CASCADE).
- `media.yolo_processed_at` column: marks an image as processed (even with 0
  objects) so backfill doesn't loop forever.
- The bbox is **always** stored; the client only **draws** it in Developer Mode.

## Backfill existing images

```bash
cd backend
npm run backfill:detect           # all users
npm run backfill:detect <userId>  # one user
```

Loops in batches (25 images/batch) until `remaining=0`. Requires the ai-service
running at `AI_SERVICE_URL`.

## Search images by object (backend)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gallery/media/objects/search?q=dog` | `MediaListItem[]` matching `class_name` (ILIKE `%q%`), with `score` = highest confidence |
| GET | `/api/gallery/media/objects/classes` | Detected classes + image count (`[{ class_name, count }]`) |
| GET | `/api/gallery/media/detection/status` | `{ total, detected, pending }` |
| POST | `/api/gallery/media/detection/backfill` | Batch backfill (`{ limit }`, ≤100) |
| GET | `/api/gallery/media/:id/detections` | Detections (with `bbox`) — used by Developer Mode |

Confidence threshold for search: env `AI_YOLO_MIN_CONF` (backend default `0.4`).

## ai-service API

| Method | Path | Input | Output |
|--------|------|-------|--------|
| POST | `/api/v1/detect/objects` | multipart `file` (image ≤10MB) | `ObjectDetectResponse` |

```bash
curl -X POST http://localhost:8000/api/v1/detect/objects -F 'file=@bus.jpg'
```

```json
{
  "provider": "yolo",
  "model": "yolo26n",
  "detections": [
    { "class_name": "bus", "confidence": 0.88, "bbox": [0.03, 0.42, 0.85, 0.94] },
    { "class_name": "person", "confidence": 0.86, "bbox": [0.12, 0.51, 0.17, 0.63] }
  ]
}
```

## Frontend

- **Spotlight search** (`SearchView.tsx`): calls four sources in parallel via
  `Promise.allSettled` — Friends / Albums / **Images (semantic)** / **Objects** →
  renders a separate "Objects" group, with a `%` badge = confidence.
- **MediaDetailsPanel**: object tag chips (grouped by class, `×n` when there are
  multiple instances).
- **Lightbox** + `DetectionOverlay`: when **Developer Mode** is on, measures the
  image frame (`object-contain`) then draws emerald bboxes + a
  `class %confidence` label (hidden while zoomed).

## Configuration

| Env | Default | Description |
|-----|---------|-------------|
| `AI_OBJECT_PROVIDER` | `stub` (prod) / `yolo` (dev compose) | `stub` / `yolo` |
| `AI_YOLO_WEIGHTS` | `yolo26n.pt` / `/opt/yolo-cache/yolo26n.pt` | Weights path/host |
| `AI_YOLO_DEVICE` | `auto` | `auto` (cuda>mps>cpu) / `cpu` |
| `AI_YOLO_CONF` | `0.25` | Provider confidence threshold |
| `AI_YOLO_IMGSZ` | `640` | Inference size |
| `AI_YOLO_MIN_CONF` (backend) | `0.4` | Confidence threshold for search |
| `AI_SERVICE_URL` (backend) | `http://localhost:8000` | Backend → ai-service |

Weights are baked into the image at `/opt/yolo-cache` (outside `/app` so the dev
volume mount doesn't overwrite them) via
`ai-service/scripts/download_yolo_weight.py` (host
`https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo26n.pt`).
