"""Base class for gesture (hand) recognition providers."""
from abc import ABC, abstractmethod

from app.schemas.detect import HandResult


class GestureProvider(ABC):
    """Abstract base — tất cả gesture providers phải implement interface này."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Tên provider (stub, mediapipe, custom...)."""
        ...

    @abstractmethod
    def detect(self, image_bytes: bytes) -> HandResult:
        """Nhận diện gesture tay từ raw image bytes.

        Args:
            image_bytes: Nội dung file ảnh (JPEG/PNG/WebP).

        Returns:
            HandResult — nếu không phát hiện gesture thì `detected=False`.
        """
        ...