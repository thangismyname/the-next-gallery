"""MediaPipe FaceLandmarker provider (face expression, baseline).

Map 52 ARKit blendshapes của FaceLandmarker → biểu cảm ngữ nghĩa:
    smile, laugh, surprised, wink, angry, sad, neutral

Chỉ trả biểu cảm + confidence (phục vụ map sang meme) — không trả landmarks.

Yêu cầu:
    - pip install mediapipe
    - python scripts/download_model.py --task face  (tải face_landmarker.task về models/)
"""
from __future__ import annotations

import io

import numpy as np
from PIL import Image

from app.providers.face_base import FaceProvider
from app.schemas.detect import FaceResult

try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        'MediaPipe chưa được cài. Chạy: pip install mediapipe '
        "(thêm 'mediapipe' vào requirements.txt)"
    ) from exc


def _bs_score(bs: dict[str, float], *names: str) -> float:
    """Điểm blendshape lớn nhất trong nhóm `names` (0 nếu thiếu key)."""
    return max((bs.get(n) or 0.0) for n in names)


def classify_expression(blendshapes: dict[str, float]) -> tuple[str, float]:
    """Map 52 blendshape (ARKit name → score 0..1) sang biểu cảm.

    Returns:
        (expression, confidence) — confidence là giá trị blendshape
        dùng để quyết định (hoặc avg đối với nhãn kết hợp).
    """
    smile = _bs_score(blendshapes, "mouthSmileLeft", "mouthSmileRight")
    frown = _bs_score(blendshapes, "mouthFrownLeft", "mouthFrownRight")
    jaw = _bs_score(blendshapes, "jawOpen")
    wide = _bs_score(blendshapes, "eyeWideLeft", "eyeWideRight")
    brow_up = _bs_score(blendshapes, "browInnerUp", "browOuterUpLeft", "browOuterUpRight")
    brow_down = _bs_score(blendshapes, "browDownLeft", "browDownRight")
    blink_l = _bs_score(blendshapes, "eyeBlinkLeft")
    blink_r = _bs_score(blendshapes, "eyeBlinkRight")
    squint = _bs_score(blendshapes, "cheekSquintLeft", "cheekSquintRight")

    # Cười lớn → cười (smile mạnh + há miệng)
    if smile >= 0.5 and jaw >= 0.35:
        return "laugh", round((smile + jaw) / 2, 3)
    if smile >= 0.4:
        return "smile", round(smile, 3)

    # Ngạc nhiên: mắt mở to + lông mày nhướng + há miệng
    if brow_up >= 0.3 and wide >= 0.3 and jaw >= 0.25:
        return "surprised", round((brow_up + wide + jaw) / 3, 3)

    # Nháy mắt: một mắt nhắm rõ, mắt kia mở
    if blink_l >= 0.55 and blink_r < 0.3:
        return "wink", round(blink_l, 3)
    if blink_r >= 0.55 and blink_l < 0.3:
        return "wink", round(blink_r, 3)

    # Giận: cau lông mày + nhíu mắt / bĩu môi
    if brow_down >= 0.35 and (squint >= 0.25 or frown >= 0.25):
        return "angry", round(max(brow_down, squint, frown), 3)

    # Buồn: lông mày trong nhướng + khóe miệng trễ xuống
    if brow_up >= 0.3 and frown >= 0.25:
        return "sad", round((brow_up + frown) / 2, 3)
    if frown >= 0.3:
        return "sad", round(frown, 3)

    # Khuôn mặt có nhưng không biểu cảm rõ → neutral
    return "neutral", round(max(smile, frown, brow_up, brow_down, jaw), 3)


class MediaPipeFaceProvider(FaceProvider):
    def __init__(self, model_path: str, num_faces: int = 1, score_threshold: float = 0.5):
        options = mp_vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(
                model_asset_path=model_path,
                delegate=mp_python.BaseOptions.Delegate.CPU,
            ),
            running_mode=mp_vision.RunningMode.IMAGE,
            num_faces=num_faces,
            min_face_detection_confidence=score_threshold,
            min_face_presence_confidence=score_threshold,
            min_tracking_confidence=score_threshold,
            output_face_blendshapes=True,
        )
        self._landmarker = mp_vision.FaceLandmarker.create_from_options(options)

    @property
    def name(self) -> str:
        return "mediapipe"

    def detect(self, image_bytes: bytes) -> FaceResult:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(img))

        result = self._landmarker.detect(mp_image)
        face_count = len(result.face_landmarks or [])
        blendshape_sets = result.face_blendshapes or []

        if face_count == 0 or not blendshape_sets:
            return FaceResult(detected=False)

        # Dùng khuôn mặt đầu tiên có blendshapes (num_faces=1 thường chỉ có 1).
        for bs_list in blendshape_sets:
            if not bs_list:
                continue
            bs = {c.category_name: float(c.score) for c in bs_list}
            expression, confidence = classify_expression(bs)
            return FaceResult(
                detected=True,
                expression=expression,
                confidence=confidence,
                faces=face_count,
            )

        return FaceResult(detected=False)