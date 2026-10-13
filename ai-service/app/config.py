from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """AI service configuration.

    Prefix `AI_` — đọc từ env / root .env (cùng convention backend:
    `.env` nằm ở project root, ai-service đọc lên 1 cấp).
    """

    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    # Provider gesture tay: "stub" | "mediapipe"
    # "stub"  = không cần model, trả về empty — dùng để chạy skeleton.
    # "mediapipe" = MediaPipe GestureRecognizer (chạy download_model.py --task hand trước).
    gesture_provider: str = "stub"

    # Provider biểu cảm khuôn mặt: "stub" | "mediapipe"
    # "stub"  = không cần model, trả về empty.
    # "mediapipe" = MediaPipe FaceLandmarker + blendshape → expression
    #               (chạy download_model.py --task face trước).
    face_provider: str = "stub"

    # Provider embedding cho semantic search: "stub" | "open_clip"
    # "stub"      = vector giả lập deterministic (không cần torch) — chạy skeleton.
    # "open_clip" = OpenCLIP image/text encoder, cần `open_clip_torch` + torch
    #               (model weights tự tải về cache lần chạy đầu).
    embed_provider: str = "stub"
    clip_model: str = "ViT-B-32"
    clip_pretrained: str = "laion2b_s34b_b79k"
    # "auto" = cuda > mps > cpu nếu có; hoặc ép "cpu" / "cuda" / "mps".
    clip_device: str = "auto"

    # Provider object detection (YOLO26): "stub" | "yolo"
    # "stub" = không cần model, trả về [] — dùng để chạy skeleton.
    # "yolo" = Ultralytics YOLO26 (COCO 80 class); weights tự tải lần đầu
    #          hoặc bake sẵn qua scripts/download_yolo_weight.py.
    object_provider: str = "stub"
    # Đường dẫn/ tên weights YOLO. Nếu là tên (vd 'yolo26n.pt') thì Ultralytics
    # tự tải về cwd; nếu là path tuyệt đối (vd /opt/yolo-cache/yolo26n.pt) thì
    # dùng file đã bake.
    yolo_weights: str = "yolo26n.pt"
    yolo_device: str = "auto"
    yolo_conf: float = 0.25
    yolo_imgsz: int = 640

    # Đường dẫn model file (tương đối với thư mục ai-service/).
    model_dir: str = "models"
    face_model_dir: str = "models"

    # CORS — FE web gọi trực tiếp /api/v1/detect (dev).
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_prefix="AI_",
        env_file=(".env", "../.env"),
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()