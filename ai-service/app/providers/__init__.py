"""Providers package — vision recognition backend implementations.

Có 3 nhóm provider:
- Gesture (tay):  `get_gesture_provider()`
- Face (biểu cảm): `get_face_provider()`
- Embedding (semantic search): `get_embedding_provider()`

Usage:
    hand = get_gesture_provider().detect(image_bytes)
    face = get_face_provider().detect(image_bytes)
    vector = get_embedding_provider().encode_image(image_bytes)
"""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.providers.base import GestureProvider
    from app.providers.embed_base import EmbeddingProvider
    from app.providers.face_base import FaceProvider
    from app.providers.object_base import ObjectDetectionProvider

HAND_MODEL_NAME = "gesture_recognizer.task"
FACE_MODEL_NAME = "face_landmarker.task"


def get_gesture_provider() -> GestureProvider:
    """Lazily create and return the configured gesture (hand) provider."""
    from app.config import get_settings

    settings = get_settings()
    provider_name = settings.gesture_provider

    if provider_name == "mediapipe":
        return _create_mediapipe_gesture_provider(settings.model_dir)
    elif provider_name == "stub":
        from app.providers.stub import StubProvider

        return StubProvider()
    else:
        raise ValueError(f"Unknown gesture provider: {provider_name!r}")


def get_face_provider() -> FaceProvider:
    """Lazily create and return the configured face (expression) provider."""
    from app.config import get_settings

    settings = get_settings()
    provider_name = settings.face_provider

    if provider_name == "mediapipe":
        return _create_mediapipe_face_provider(settings.face_model_dir)
    elif provider_name == "stub":
        from app.providers.face_stub import FaceStubProvider

        return FaceStubProvider()
    else:
        raise ValueError(f"Unknown face provider: {provider_name!r}")


def get_embedding_provider() -> EmbeddingProvider:
    """Lazily create and return the configured embedding provider."""
    from app.config import get_settings

    settings = get_settings()
    provider_name = settings.embed_provider

    if provider_name == "open_clip":
        from app.providers.clip import OpenClipEmbeddingProvider

        return OpenClipEmbeddingProvider(
            settings.clip_model,
            settings.clip_pretrained,
            settings.clip_device,
        )
    elif provider_name == "stub":
        from app.providers.embed_stub import StubEmbeddingProvider

        return StubEmbeddingProvider()
    else:
        raise ValueError(f"Unknown embedding provider: {provider_name!r}")


def get_object_provider() -> ObjectDetectionProvider:
    """Lazily create and return the configured object detection provider."""
    from app.config import get_settings

    settings = get_settings()
    provider_name = settings.object_provider

    if provider_name == "yolo":
        from app.providers.yolo import YoloObjectDetectionProvider

        return YoloObjectDetectionProvider(
            settings.yolo_weights,
            settings.yolo_device,
            settings.yolo_conf,
            settings.yolo_imgsz,
        )
    elif provider_name == "stub":
        from app.providers.object_stub import StubObjectDetectionProvider

        return StubObjectDetectionProvider()
    else:
        raise ValueError(f"Unknown object provider: {provider_name!r}")


def _create_mediapipe_gesture_provider(model_dir: str) -> "GestureProvider":
    model_path = os.path.join(model_dir, HAND_MODEL_NAME)

    if not os.path.exists(model_path):
        raise RuntimeError(
            f"MediaPipe gesture model not found at {model_path!r}. "
            "Run: python scripts/download_model.py --task hand"
        )

    from app.providers.mediapipe import MediaPipeProvider

    return MediaPipeProvider(model_path)


def _create_mediapipe_face_provider(model_dir: str) -> "FaceProvider":
    model_path = os.path.join(model_dir, FACE_MODEL_NAME)

    if not os.path.exists(model_path):
        raise RuntimeError(
            f"MediaPipe face model not found at {model_path!r}. "
            "Run: python scripts/download_model.py --task face"
        )

    from app.providers.face_mediapipe import MediaPipeFaceProvider

    return MediaPipeFaceProvider(model_path)