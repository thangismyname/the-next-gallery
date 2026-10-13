"""Base class for face (expression) recognition providers."""
from abc import ABC, abstractmethod

from app.schemas.detect import FaceResult


class FaceProvider(ABC):
    """Abstract base — tất cả face providers phải implement interface này."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Tên provider (stub, mediapipe, custom...)."""
        ...

    @abstractmethod
    def detect(self, image_bytes: bytes) -> FaceResult:
        """Nhận diện biểu cảm khuôn mặt từ raw image bytes.

        Args:
            image_bytes: Nội dung file ảnh (JPEG/PNG/WebP).

        Returns:
            FaceResult — nếu không thấy mặt thì `detected=False`.
        """
        ...