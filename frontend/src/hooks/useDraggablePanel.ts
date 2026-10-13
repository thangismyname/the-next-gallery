import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface PanelPosition {
  x: number;
  y: number;
}

const VIEWPORT_MARGIN = 8;
const DEFAULT_POS: PanelPosition = { x: 0, y: 0 };

function readStoredPos(storageKey?: string): PanelPosition | null {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* bỏ qua dữ liệu hỏng */
  }
  return null;
}

/**
 * Di chuyển panel nổi bằng cách kéo header (pointer events).
 * Vị trí là offset so với vị trí layout mặc định (đang canh giữa), lưu localStorage.
 */
export function useDraggablePanel({ storageKey }: { storageKey?: string }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<PanelPosition>(
    () => readStoredPos(storageKey) ?? DEFAULT_POS,
  );
  const [isDragging, setIsDragging] = useState(false);

  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const persist = useCallback(
    (next: PanelPosition) => {
      if (!storageKey || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* localStorage có thể bị chặn */
      }
    },
    [storageKey],
  );

  // Trong lúc kéo: khóa chọn text + đổi con trỏ toàn cục.
  useEffect(() => {
    if (!isDragging) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [isDragging]);

  const startDrag = useCallback(
    (e: ReactPointerEvent) => {
      const el = panelRef.current;
      if (!el) return;

      const startRect = el.getBoundingClientRect();
      const startPos = posRef.current;
      const startX = e.clientX;
      const startY = e.clientY;
      let latest = startPos;

      const onMove = (ev: PointerEvent) => {
        const maxLeft = Math.max(
          VIEWPORT_MARGIN,
          window.innerWidth - startRect.width - VIEWPORT_MARGIN,
        );
        const maxTop = Math.max(
          VIEWPORT_MARGIN,
          window.innerHeight - startRect.height - VIEWPORT_MARGIN,
        );
        const left = Math.min(
          Math.max(startRect.left + (ev.clientX - startX), VIEWPORT_MARGIN),
          maxLeft,
        );
        const top = Math.min(
          Math.max(startRect.top + (ev.clientY - startY), VIEWPORT_MARGIN),
          maxTop,
        );
        const next = {
          x: startPos.x + (left - startRect.left),
          y: startPos.y + (top - startRect.top),
        };
        latest = next;
        setPos(next);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setIsDragging(false);
        persist(latest);
      };

      setIsDragging(true);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [persist],
  );

  const resetPos = useCallback(() => {
    setPos(DEFAULT_POS);
    persist(DEFAULT_POS);
  }, [persist]);

  // Giữ panel trong viewport khi cửa sổ đổi kích thước.
  useEffect(() => {
    const onWindowResize = () => {
      const el = panelRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (r.left < VIEWPORT_MARGIN) dx = VIEWPORT_MARGIN - r.left;
      else if (r.right > window.innerWidth - VIEWPORT_MARGIN)
        dx = window.innerWidth - VIEWPORT_MARGIN - r.right;
      if (r.top < VIEWPORT_MARGIN) dy = VIEWPORT_MARGIN - r.top;
      else if (r.bottom > window.innerHeight - VIEWPORT_MARGIN)
        dy = window.innerHeight - VIEWPORT_MARGIN - r.bottom;
      if (dx || dy) setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, []);

  return { panelRef, pos, isDragging, startDrag, resetPos };
}
