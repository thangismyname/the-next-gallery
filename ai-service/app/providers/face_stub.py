"""Stub face provider — no model, always returns nothing."""
from app.providers.face_base import FaceProvider
from app.schemas.detect import FaceResult


class FaceStubProvider(FaceProvider):
    @property
    def name(self) -> str:
        return "stub"

    def detect(self, image_bytes: bytes) -> FaceResult:
        return FaceResult(detected=False)