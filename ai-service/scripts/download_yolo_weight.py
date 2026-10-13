#!/usr/bin/env python3
"""Pre-download YOLO26 weights (object detection) — phục vụ backfill/search.

Usage:
    python scripts/download_yolo_weight.py [--model yolo26n.pt] [--dir /opt/yolo-cache]

Ultralytics tải weights về thư mục làm việc (cwd), nên script chuyển cwd sang
`--dir` rồi khởi tạo YOLO(model) để file .pt nằm đúng chỗ. Dùng trong Dockerfile
để bake weights vào image (runtime không cần internet), hoặc chạy thủ công trên
host.

Sau khi chạy, set `AI_YOLO_WEIGHTS=<dir>/<model>` để provider dùng file đã tải.
"""
from __future__ import annotations

import argparse
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Tải YOLO26 weights.")
    parser.add_argument(
        "--model",
        default=os.environ.get("AI_YOLO_WEIGHTS", "yolo26n.pt"),
        help="Tên file weights (default: $AI_YOLO_WEIGHTS hoặc yolo26n.pt).",
    )
    parser.add_argument(
        "--dir",
        default=os.environ.get("AI_YOLO_DIR", "/opt/yolo-cache"),
        help="Thư mục chứa weights (default: $AI_YOLO_DIR hoặc /opt/yolo-cache).",
    )
    args = parser.parse_args()

    os.makedirs(args.dir, exist_ok=True)
    target = os.path.join(args.dir, os.path.basename(args.model))

    if os.path.exists(target):
        print(f"✅ Weights đã có sẵn: {target}", flush=True)
        return 0

    try:
        from ultralytics import YOLO
    except ImportError:
        print(
            "Lỗi: chưa cài ultralytics. Chạy: pip install ultralytics "
            "(Dockerfile đã cài sẵn).",
            file=sys.stderr,
        )
        return 1

    print(f"Đang tải YOLO weights {args.model!r} vào {args.dir!r} ...", flush=True)
    os.chdir(args.dir)
    YOLO(os.path.basename(args.model))

    if os.path.exists(target):
        print(f"✅ Done: {target}", flush=True)
        print(
            "Khi chạy ai-service set AI_YOLO_WEIGHTS="
            f"{target} để không tải lại.",
            flush=True,
        )
        return 0
    print(f"⚠️  Không thấy file {target} sau khi tải.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
