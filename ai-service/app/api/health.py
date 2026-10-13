from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    settings = get_settings()
    return {
        "status": "ok",
        "provider": settings.gesture_provider,
        "face_provider": settings.face_provider,
        "embed_provider": settings.embed_provider,
        "clip_model": settings.clip_model,
    }