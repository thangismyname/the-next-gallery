import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, LayoutGrid, X } from "lucide-react";
import { Moment } from "@/types";
import { TemplateMedia } from "./TemplateMedia";
import { getMomentParticipants } from "../participants";

type Props = {
  items: Moment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export const MomentViewer: React.FC<Props> = ({
  items,
  index,
  onIndexChange,
  onClose,
}) => {
  const { t } = useTranslation();
  const moment = items[index];

  // null = xem cả template (collage); khác null = index trong filledSlots đang phóng to.
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);

  const filledSlots = useMemo(
    () => moment?.slots.filter((s) => s.filled) ?? [],
    [moment],
  );
  const isMulti = moment?.template !== "single";

  // Reset zoom khi đổi moment.
  useEffect(() => {
    setZoomIdx(null);
  }, [moment?.id]);

  useEffect(() => {
    if (!moment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        if (zoomIdx !== null) {
          setZoomIdx((p) => (p === null ? p : Math.max(0, p - 1)));
        } else if (index > 0) {
          onIndexChange(index - 1);
        }
      }
      if (e.key === "ArrowRight") {
        if (zoomIdx !== null) {
          setZoomIdx((p) =>
            p === null ? p : Math.min(filledSlots.length - 1, p + 1),
          );
        } else if (index < items.length - 1) {
          onIndexChange(index + 1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    moment,
    zoomIdx,
    index,
    items.length,
    filledSlots.length,
    onClose,
    onIndexChange,
  ]);

  if (!moment) return null;

  const hasPrevMoment = index > 0;
  const hasNextMoment = index < items.length - 1;
  const zoomedSlot = zoomIdx !== null ? filledSlots[zoomIdx] : null;
  const zoomMode = isMulti && zoomIdx !== null;

  const mediaUrl = zoomMode ? zoomedSlot?.url : moment.url;
  const mediaType = zoomMode ? zoomedSlot?.mediaType : moment.mediaType;
  const mediaAlt = zoomMode
    ? (zoomedSlot?.userName ?? moment.userName)
    : (moment.caption ?? moment.userName);

  return (
    <div
      className="fixed inset-0 z-70 flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4 text-white">
        <span className="text-sm font-medium">
          {isMulti
            ? (() => {
                const participants = getMomentParticipants(moment);
                return participants.length > 1
                  ? t("moments.collabMembers", {
                      name: participants[0].userName,
                      count: participants.length - 1,
                    })
                  : moment.userName;
              })()
            : moment.userName}
          {moment.isOwn ? ` · ${t("moments.you")}` : ""}
        </span>
        <div className="flex items-center gap-1">
          {zoomMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoomIdx(null);
              }}
              className="grid size-10 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label={t("moments.viewAll")}
              title={t("moments.viewAll")}
            >
              <LayoutGrid className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label={t("moments.close")}
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Media */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-12">
        {isMulti && zoomIdx === null ? (
          /* ── Chế độ collage: hiện toàn bộ ảnh của moment ── */
          <div
            className="relative aspect-4/5 h-full w-full max-w-sm max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <TemplateMedia
              moment={moment}
              t={t}
              onImageClick={(slotIndex) => {
                if (slotIndex < 0) return;
                const i = filledSlots.findIndex(
                  (s) => s.slotIndex === slotIndex,
                );
                setZoomIdx(i >= 0 ? i : null);
              }}
            />
          </div>
        ) : zoomMode ? (
          /* ── Chế độ phóng to 1 slot cụ thể ── */
          <>
            {mediaType === "video" ? (
              <video
                src={mediaUrl ?? ""}
                autoPlay
                loop
                controls
                playsInline
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={mediaUrl ?? ""}
                alt={mediaAlt}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {/* Counter + tên người sở hữu slot */}
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/90 backdrop-blur-sm">
              {t("moments.photoOf", {
                current: zoomIdx + 1,
                total: filledSlots.length,
              })}
              {zoomedSlot
                ? ` · ${t("moments.photoBy", { name: zoomedSlot.userName })}`
                : ""}
            </div>

            {filledSlots.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomIdx((p) => (p === null ? p : Math.max(0, p - 1)));
                  }}
                  className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white disabled:opacity-30"
                  disabled={zoomIdx <= 0}
                  aria-label={t("moments.prev")}
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomIdx((p) =>
                      p === null ? p : Math.min(filledSlots.length - 1, p + 1),
                    );
                  }}
                  className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white disabled:opacity-30"
                  disabled={zoomIdx >= filledSlots.length - 1}
                  aria-label={t("moments.next")}
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </>
        ) : (
          /* ── single: 1 ảnh/video ── */
          <>
            {mediaType === "video" ? (
              <video
                src={mediaUrl ?? ""}
                autoPlay
                loop
                controls
                playsInline
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={mediaUrl ?? ""}
                alt={mediaAlt}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </>
        )}

        {/* Mũi tên chuyển moment (chỉ khi đang xem collage / single) */}
        {!zoomMode && hasPrevMoment && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange(index - 1);
            }}
            className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
            aria-label={t("moments.prev")}
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        {!zoomMode && hasNextMoment && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange(index + 1);
            }}
            className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
            aria-label={t("moments.next")}
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {/* Caption + time */}
      <div
        className="shrink-0 space-y-1 px-4 pb-6 pt-2 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {moment.caption && (
          <p className="mx-auto max-w-md whitespace-pre-wrap wrap-break-word text-sm text-white/90">
            {moment.caption}
          </p>
        )}
        <p className="text-xs text-white/50">
          {new Date(moment.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
};
