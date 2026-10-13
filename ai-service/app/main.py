from contextlib import asynccontextmanager
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api import health, detect, embed, object_detect
from app.providers import (
    get_embedding_provider,
    get_face_provider,
    get_gesture_provider,
    get_object_provider,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm provider (MediaPipe graph) NGAY TẠI STARTUP, trên main thread.
    # Nếu tạo trong request threadpool → macOS abort: "Check failed: service_
    # Service is unavailable" (DrishtiMetalHelper khởi tạo trong thread ngoài main).
    # Std: FastAPI lifespan chạy trên event loop = main thread của process.
    app.state.gesture_provider = get_gesture_provider()
    app.state.face_provider = get_face_provider()
    # Embedding provider (OpenCLIP) cũng load 1 lần tại startup — model nặng,
    # không tạo lại theo request. Chỉ dùng khi bật semantic search.
    app.state.embed_provider = get_embedding_provider()
    # Object detection (YOLO26) — load 1 lần tại startup khi bật provider.
    app.state.object_provider = get_object_provider()
    # MediaPipe recognizer không thread-safe → serialize các detect call.
    app.state.vision_lock = threading.Lock()
    # YOLO predict cũng chạy tuần tự để tránh tranh chấp model trên CPU.
    app.state.object_lock = threading.Lock()
    yield


app = FastAPI(
    title="The Next Gallery — AI Service",
    description="Gesture (hand) + face expression recognition + OpenCLIP embeddings for semantic search",
    version="0.3.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(detect.router, prefix="/api/v1", tags=["gesture"])
app.include_router(embed.router, prefix="/api/v1", tags=["embedding"])
app.include_router(object_detect.router, prefix="/api/v1", tags=["object-detection"])


@app.get("/")
async def root():
    return {
        "service": "ai-service",
        "version": "0.3.0",
        "docs": "/docs",
    }