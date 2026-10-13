"""Stub object detection provider — không cần model/torch.

Trả về danh sách rỗng. Dùng để chạy skeleton khi chưa cài ultralytics
hoặc không muốn tải model (AI_OBJECT_PROVIDER=stub).
"""
from __future__ import annotations

from app.providers.object_base import ObjectDetectionProvider


class StubObjectDetectionProvider(ObjectDetectionProvider):
    @property
    def name(self) -> str:
        return "stub"

    @property
    def model(self) -> str:
        return "stub"

    def detect(self, image_bytes: bytes) -> list[dict]:
        return []
