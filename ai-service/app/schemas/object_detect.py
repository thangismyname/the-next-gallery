"""Pydantic schemas cho object detection API (YOLO26).

`POST /api/v1/detect/objects` → `ObjectDetectResponse`: danh sách object
(class + confidence + bbox chuẩn hoá) phát hiện trong 1 ảnh.
"""
from pydantic import BaseModel, Field


class ObjectDetection(BaseModel):
    """Một object phát hiện được."""
    class_name: str = Field(
        ...,
        examples=["person"],
        description="COCO class name do YOLO trả về.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        examples=[0.91],
        description="Độ tin cậy 0–1.",
    )
    bbox: list[float] = Field(
        ...,
        min_length=4,
        max_length=4,
        examples=[[0.1, 0.2, 0.5, 0.8]],
        description="Bounding box [x1, y1, x2, y2] chuẩn hoá 0–1.",
    )


class ObjectDetectResponse(BaseModel):
    """Kết quả object detection cho 1 ảnh."""
    provider: str = Field(
        default="stub",
        examples=["yolo"],
        description="Provider đang dùng: 'stub' | 'yolo'.",
    )
    model: str = Field(
        default="stub",
        examples=["yolo26n"],
        description="Tên model (vd yolo26n).",
    )
    detections: list[ObjectDetection] = Field(
        default_factory=list,
        description="Object phát hiện được, sắp theo confidence giảm dần.",
    )
