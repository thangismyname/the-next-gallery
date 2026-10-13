import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

interface ZoomState {
  zoom: number;
  pan: { x: number; y: number };
}

// Zoom & pan cho Lightbox: wheel/dblclick zoom, kéo khi zoom > 1, clamp theo vùng ảnh.
// - isVideo: disabled zoom (giữ ref để tránh stale trong wheel/zoomStep).
// - resetKey: khi đổi giá trị (media.id) → reset zoom/pan về gốc.
export function useLightboxZoom({
  isVideo,
  resetKey,
  maxZoom = 5,
}: {
  isVideo: boolean;
  resetKey: string;
  maxZoom?: number;
}) {
  const [view, setView] = useState<ZoomState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const viewRef = useRef(view);
  const isVideoRef = useRef(isVideo);
  const imgAreaRef = useRef<HTMLDivElement | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panGesture = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    isVideoRef.current = isVideo;
  }, [isVideo]);

  const clampPan = useCallback(
    (pan: { x: number; y: number }, zoom: number, rect: DOMRect) => {
      const halfX = (rect.width / 2) * Math.max(zoom - 1, 0);
      const halfY = (rect.height / 2) * Math.max(zoom - 1, 0);
      return {
        x: Math.min(halfX, Math.max(-halfX, pan.x)),
        y: Math.min(halfY, Math.max(-halfY, pan.y)),
      };
    },
    [],
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const el = imgAreaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const { zoom: z, pan: p } = viewRef.current;
      const px = cx - rect.left - rect.width / 2;
      const py = cy - rect.top - rect.height / 2;
      const wx = (px - p.x) / z;
      const wy = (py - p.y) / z;
      const nz = Math.min(maxZoom, Math.max(1, z * factor));
      if (nz === 1) {
        setView({ zoom: 1, pan: { x: 0, y: 0 } });
        return;
      }
      setView({
        zoom: nz,
        pan: clampPan({ x: px - wx * nz, y: py - wy * nz }, nz, rect),
      });
    },
    [clampPan, maxZoom],
  );

  const resetZoom = useCallback(() => {
    setView({ zoom: 1, pan: { x: 0, y: 0 } });
  }, []);

  // Lăn chuột zoom: dùng native listener để preventDefault (chống cuộn trang)
  useEffect(() => {
    const el = imgAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isVideoRef.current) return;
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Reset zoom khi đổi ảnh
  useEffect(() => {
    resetZoom();
  }, [resetKey, resetZoom]);

  const zoomStep = useCallback(
    (factor: number) => {
      if (isVideoRef.current) return;
      const el = imgAreaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [zoomAt],
  );

  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      if (isVideoRef.current) return;
      const { zoom: z } = viewRef.current;
      if (z > 1) resetZoom();
      else zoomAt(e.clientX, e.clientY, 2);
    },
    [resetZoom, zoomAt],
  );

  const onImgPointerDown = (e: ReactPointerEvent) => {
    if (isVideoRef.current || viewRef.current.zoom <= 1) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    panGesture.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: viewRef.current.pan.x,
      originY: viewRef.current.pan.y,
    };
    setIsPanning(true);
  };

  const onImgPointerMove = (e: ReactPointerEvent) => {
    const g = panGesture.current;
    const el = imgAreaRef.current;
    if (!g.dragging || !el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const { zoom } = viewRef.current;
    setView({
      zoom,
      pan: clampPan({ x: g.originX + dx, y: g.originY + dy }, zoom, rect),
    });
  };

  const onImgPointerUp = (e: ReactPointerEvent) => {
    if (
      panGesture.current.dragging &&
      e.currentTarget.hasPointerCapture(e.pointerId)
    ) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    panGesture.current.dragging = false;
    setIsPanning(false);
  };

  return {
    view,
    isPanning,
    imgAreaRef,
    zoomStep,
    resetZoom,
    handleDoubleClick,
    onImgPointerDown,
    onImgPointerMove,
    onImgPointerUp,
  };
}