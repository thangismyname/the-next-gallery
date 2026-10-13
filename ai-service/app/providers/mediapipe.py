"""MediaPipe GestureRecognizer provider (hand gesture, baseline).

Nhận diện số tay (1 tay), image mode, trả về các label dựng sẵn của
MediaPipe: Thumb_Up, Victory, Closed_Fist, Open_Palm, Pointing_Up,
Thumb_Down, ILoveYou, None...

Label ngữ nghĩa → meme mapping nằm ở BACKEND/FE (node), service này
chỉ trả về label + confidence thuần.

Yêu cầu:
    - pip install mediapipe
    - python scripts/download_model.py --task hand  (tải gesture_recognizer.task về models/)
"""
from __future__ import annotations

import io

import numpy as np
from PIL import Image

from app.providers.base import GestureProvider
from app.schemas.detect import GestureResult, HandResult

try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        'MediaPipe chưa được cài. Chạy: pip install mediapipe '
        "(thêm 'mediapipe' vào requirements.txt)"
    ) from exc


class MediaPipeProvider(GestureProvider):
    def __init__(self, model_path: str, num_hands: int = 1, score_threshold: float = 0.5):
        options = mp_vision.GestureRecognizerOptions(
            base_options=mp_python.BaseOptions(
                model_asset_path=model_path,
                delegate=mp_python.BaseOptions.Delegate.CPU,
            ),
            running_mode=mp_vision.RunningMode.IMAGE,
            num_hands=num_hands,
            min_hand_detection_confidence=score_threshold,
            min_hand_presence_confidence=score_threshold,
            min_tracking_confidence=score_threshold,
        )
        self._num_hands = num_hands
        self._recognizer = mp_vision.GestureRecognizer.create_from_options(options)

    @property
    def name(self) -> str:
        return "mediapipe"

    def detect(self, image_bytes: bytes) -> HandResult:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(img))

        result = self._recognizer.recognize(mp_image)
        gestures: list[GestureResult] = []

        if result.gestures:
            for gesture_list in result.gestures:
                for gesture in gesture_list:
                    label = gesture.category_name
                    if label is None:
                        continue
                    gestures.append(
                        GestureResult(label=label, confidence=round(float(gesture.score), 3))
                    )

        gestures.sort(key=lambda g: g.confidence, reverse=True)
        if not gestures:
            return HandResult(detected=False)

        top = gestures[0]
        return HandResult(
            detected=True,
            label=top.label,
            confidence=top.confidence,
            gestures=gestures,
        )