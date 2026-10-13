from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.schemas.detect import DetectResponse, FaceResult, HandResult

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


@router.post("/detect", response_model=DetectResponse)
async def detect(request: Request, file: UploadFile = File(...)):
    """Nhận diện gesture tay + biểu cảm khuôn mặt trong 1 lần gọi.

    Nhận 1 file ảnh (JPEG/PNG/WebP/GIF), trả về `DetectResponse` hợp nhất:
    - `hand`: gesture tay (GestureRecognizer / stub).
    - `face`: biểu cảm khuôn mặt map từ FaceLandmarker blendshapes / stub.

    Task nào không có provider thật hoặc không phát hiện được → `detected=false`.
    """
    if not file.content_type or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {file.content_type}. "
            f"Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}",
        )

    image_bytes = await file.read()

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {len(image_bytes)} bytes. Max: {MAX_FILE_SIZE}",
        )

    # Providers được tạo ở lifespan (main thread). MediaPipe recognizer không
    # thread-safe → chạy detect tuần tự qua vision_lock.
    hand_provider = request.app.state.gesture_provider
    face_provider = request.app.state.face_provider
    vision_lock = request.app.state.vision_lock

    with vision_lock:
        hand: HandResult = hand_provider.detect(image_bytes)
        face: FaceResult = face_provider.detect(image_bytes)

    provider = (
        "mediapipe"
        if hand_provider.name == "mediapipe" or face_provider.name == "mediapipe"
        else "stub"
    )

    return DetectResponse(provider=provider, hand=hand, face=face)