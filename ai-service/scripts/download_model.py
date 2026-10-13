#!/usr/bin/env python3
"""Download MediaPipe vision models.

Usage:
    python scripts/download_model.py [OPTIONS]

Options:
    --task  hand | face | all   getModel(s). Default: all.
    --dir   OUTPUT_DIR        Thư mục lưu models/. Default: models/

Bản=default:
    gesture_recognizer.task  — hand gesture (8 categories)
    face_landmarker.task     — face expression (478 landmarks + 52 blendshapes)
"""
from __future__ import annotations

import argparse
import sys
import urllib.request

# macOS Python thường thiếu CA cert cho HTTPS → dùng certifi để tạo SSL context.
try:
    import certifi  # noqa: F401
    import ssl

    ssl._create_default_https_context = lambda: ssl.create_default_context(
        cafile=certifi.where()
    )
except ImportError:
    pass

HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task"
)
HAND_MODEL_NAME = "gesture_recognizer.task"

FACE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
)
FACE_MODEL_NAME = "face_landmarker.task"


def _download(url: str, dest: str) -> bool:
    print(f"Đang tải: {url}")
    print(f"Lưu vào:  {dest}")
    try:
        urllib.request.urlretrieve(url, dest)
        print("Xong.\n")
        return True
    except Exception as exc:
        print(f"Lỗi: {exc}", file=sys.stderr)
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Tải model MediaPipe cho ai-service.")
    parser.add_argument(
        "--task",
        choices=["hand", "face", "all"],
        default="all",
        help="Task cần download (default: all).",
    )
    parser.add_argument(
        "--dir",
        default="models",
        help="Thư mục models/ output (default: models/).",
    )
    args = parser.parse_args()

    ok = True
    if args.task in ("hand", "all"):
        ok = _download(HAND_MODEL_URL, f"{args.dir}/{HAND_MODEL_NAME}") and ok

    if args.task in ("face", "all"):
        ok = _download(FACE_MODEL_URL, f"{args.dir}/{FACE_MODEL_NAME}") and ok

    if ok:
        print("✅ Done. Bật provider bằng cách set env:\n"
              "  AI_GESTURE_PROVIDER=mediapipe\n"
              "  AI_FACE_PROVIDER=mediapipe\n"
              "(hoặc giữ 'stub' nếu chưa có model).")
    else:
        print("⚠️  Có lỗi khi tải 1+ model.", file=sys.stderr)

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())