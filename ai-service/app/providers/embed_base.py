"""Base class for embedding providers (semantic search).

Provider embedding phải trả vector đã chuẩn hoá L2 (unit vector) để backend
dùng trực tiếp phép cosine similarity (toán tử `<=>` của pgvector).
"""
from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    """Abstract base — tất cả embedding providers phải implement interface này."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Tên provider (stub, open_clip, custom...)."""
        ...

    @property
    @abstractmethod
    def model(self) -> str:
        """Tên model đang dùng (vd 'ViT-B-32')."""
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Số chiều của vector embedding."""
        ...

    @abstractmethod
    def encode_image(self, image_bytes: bytes) -> list[float]:
        """Mã hoá ảnh thành vector embedding (unit norm).

        Args:
            image_bytes: Nội dung file ảnh (JPEG/PNG/WebP).

        Returns:
            list[float] độ dài `dimension`.
        """
        ...

    @abstractmethod
    def encode_text(self, text: str) -> list[float]:
        """Mã hoá câu truy vấn thành vector embedding (unit norm).

        Args:
            text: Câu truy vấn tự nhiên (vd "chó đang chạy trên bãi biển").

        Returns:
            list[float] độ dài `dimension`.
        """
        ...

    def classify(
        self,
        image_bytes: bytes,
        labels: list[str],
        templates: list[str] | None = None,
    ) -> list[dict]:
        """Zero-shot classification (demo bài CLIP paper).

        Gửi 1 ảnh + danh sách nhãn → trả xác suất softmax cho từng nhãn.

        Args:
            image_bytes: Nội dung file ảnh (JPEG/PNG/WebP).
            labels: Danh sách nhãn tối thiểu 2 (vd ["dog", "car"]).
            templates: Prompt templates CLIP, mỗi cái chứa `{}` cho nhãn.
                Mặc định ["a photo of a {}"].

        Returns:
            list[dict] mỗi phần tử {"label", "probability", "similarity"},
            sắp theo probability giảm dần.
        """
        raise NotImplementedError
