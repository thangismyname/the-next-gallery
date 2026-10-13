"""Object detection provider abstraction (YOLO26).

Provider nhận 1 ảnh (bytes) và trả về danh sách object phát hiện được:
class (COCO), confidence và bounding box chuẩn hoá 0–1.

Chuẩn hoá bbox để client có thể vẽ box trên ảnh ở bất kỳ kích thước nào
(không phụ thuộc độ phân giải gốc).
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class ObjectDetectionProvider(ABC):
    """ABC cho object detection provider."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Tên provider: 'yolo' | 'stub'."""
        ...

    @property
    @abstractmethod
    def model(self) -> str:
        """Tên model (vd 'yolo26n')."""
        ...

    @abstractmethod
    def detect(self, image_bytes: bytes) -> list[dict]:
        """Phát hiện object trong ảnh.

        Args:
            image_bytes: Nội dung file ảnh (JPEG/PNG/WebP).

        Returns:
            list các dict:
                {
                    "class_name": str,          # COCO class, vd "person"
                    "confidence": float,        # 0–1
                    "bbox": [x1, y1, x2, y2],   # chuẩn hoá 0–1
                }
            Sắp theo confidence giảm dần. Ảnh không có object → [].
        """
        ...
