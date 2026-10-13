"""Stub gesture provider — no model, always returns nothing.

Dùng để chạy skeleton / development khi chưa có provider thật.
"""
from app.providers.base import GestureProvider
from app.schemas.detect import HandResult


class StubProvider(GestureProvider):
    @property
    def name(self) -> str:
        return "stub"

    def detect(self, image_bytes: bytes) -> HandResult:
        return HandResult(detected=False)