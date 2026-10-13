"""Pydantic schemas for vision detection API (hand gesture + face expression).

Một request `/api/v1/detect` trả về KẾT QUẢ HỢP NHẤT `DetectResponse`:
- `hand`  — nhận diện gesture tay (GestureRecognizer / stub).
- `face`  — nhận diện biểu cảm khuôn mặt từ FaceLandmarker blendshapes / stub.

Task nào không bật provider / không phát hiện được → object tương ứng có
`detected = false`, không có `label`/`expression`.
"""
from pydantic import BaseModel, Field


class GestureResult(BaseModel):
    """Một gesture tay được nhận diện."""
    label: str = Field(
        ...,
        examples=["Thumb_Up"],
        description="Tên gesture (MediaPipe gesture label hoặc custom label).",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        examples=[0.92],
        description="Độ tin cậy 0–1.",
    )


class HandResult(BaseModel):
    """Kết quả gesture tay (một phần của DetectResponse)."""
    detected: bool = Field(
        ...,
        description="True nếu có ít nhất 1 gesture được nhận diện.",
    )
    label: str | None = Field(
        default=None,
        examples=["Thumb_Up"],
        description="Gesture có confidence cao nhất (None nếu không phát hiện).",
    )
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Confidence của label trên.",
    )
    gestures: list[GestureResult] = Field(
        default_factory=list,
        description="Toàn bộ gesture nhận diện được, sắp theo confidence giảm dần.",
    )


class FaceResult(BaseModel):
    """Kết quả biểu cảm khuôn mặt (một phần của DetectResponse)."""
    detected: bool = Field(
        ...,
        description="True nếu có khuôn mặt được phát hiện.",
    )
    expression: str | None = Field(
        default=None,
        examples=["smile"],
        description="Biểu cảm map từ blendshape: smile/laugh/surprised/wink/angry/sad/neutral.",
    )
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Độ tin cậy nguồn blendshape dùng để quyết định expression.",
    )
    faces: int = Field(
        default=0,
        description="Số khuôn mặt phát hiện (dùng với provider thật).",
    )


class DetectResponse(BaseModel):
    """Kết quả nhận diện hợp nhất từ 1 ảnh — cả tay lẫn mặt."""
    provider: str = Field(
        default="stub",
        examples=["mediapipe"],
        description="Provider đang dùng: 'stub' nếu không có provider nào thật, ngược lại 'mediapipe'.",
    )
    hand: HandResult = Field(
        default_factory=lambda: HandResult(detected=False),
        description="Kết quả gesture tay.",
    )
    face: FaceResult = Field(
        default_factory=lambda: FaceResult(detected=False),
        description="Kết quả biểu cảm khuôn mặt.",
    )