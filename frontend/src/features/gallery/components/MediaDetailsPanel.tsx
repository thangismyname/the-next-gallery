import React from "react";
import { useTranslation } from "react-i18next";
import {
  Heart,
  CalendarDays,
  Image as ImageIcon,
  HardDrive,
  Timer,
  ScanLine,
  Tags,
} from "lucide-react";
import { Media } from "@/types";
import { cn } from "@/lib/utils";
import { useMediaDetections } from "@/hooks/useMediaDetections";

interface MediaDetailsPanelProps {
  media: Media;
  /** Chỉ fetch detection khi panel đang mở (tránh request thừa khi panel ẩn). */
  active?: boolean;
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds?: number | null) {
  if (!seconds && seconds !== 0) return "";
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const DetailRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 flex items-center text-white/40">{icon}</span>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="text-sm text-white wrap-break-word">{value}</p>
    </div>
  </div>
);

/** Panel chi tiết inline — nằm bên trái ảnh trong layout flex của Lightbox */
export const MediaDetailsPanel: React.FC<MediaDetailsPanelProps> = ({
  media,
  active = true,
}) => {
  const { t } = useTranslation();
  const isVideo = media.mediaType === "video";
  const { detections } = useMediaDetections(active ? media.id : null);

  // Gộp theo class: giữ confidence cao nhất + đếm số lần xuất hiện.
  const tagMap = new Map<string, { confidence: number; count: number }>();
  for (const det of detections) {
    const existing = tagMap.get(det.class_name);
    if (existing) {
      existing.count += 1;
      existing.confidence = Math.max(existing.confidence, det.confidence);
    } else {
      tagMap.set(det.class_name, {
        confidence: det.confidence,
        count: 1,
      });
    }
  }
  const tags = Array.from(tagMap.entries()).sort(
    (a, b) => b[1].confidence - a[1].confidence,
  );

  return (
    <div
      className="h-full w-full md:w-80 shrink-0 flex flex-col md:border-l border-white/10 bg-white/3"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">
          {t("lightbox.detail")}
        </h3>
      </div>

      {/* Scrollable content — min-h-0 để cuộn được trong chiều cao giới hạn (mobile) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {media.title && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1">
              {t("lightbox.detailTitle")}
            </p>
            <p className="text-sm text-white wrap-break-word">{media.title}</p>
          </div>
        )}

        <div className="space-y-2.5">
          <DetailRow
            icon={<ImageIcon size={14} />}
            label={t("lightbox.detailType")}
            value={isVideo ? t("lightbox.video") : t("lightbox.photo")}
          />
          {media.width && media.height && (
            <DetailRow
              icon={<ScanLine size={14} />}
              label={t("lightbox.detailResolution")}
              value={`${media.width} × ${media.height}px`}
            />
          )}
          {formatBytes(media.sizeBytes) && (
            <DetailRow
              icon={<HardDrive size={14} />}
              label={t("lightbox.detailSize")}
              value={formatBytes(media.sizeBytes)}
            />
          )}
          {isVideo && formatDuration(media.durationSeconds) && (
            <DetailRow
              icon={<Timer size={14} />}
              label={t("lightbox.detailDuration")}
              value={formatDuration(media.durationSeconds)}
            />
          )}
          {formatDate(media.createdAt) && (
            <DetailRow
              icon={<CalendarDays size={14} />}
              label={t("lightbox.detailDate")}
              value={formatDate(media.createdAt)}
            />
          )}
        </div>

        {tags.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 mb-2">
              <Tags size={13} className="text-white/40" />
              <p className="text-[11px] uppercase tracking-wide text-white/40">
                {t("lightbox.detailObjects")}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(([name, info]) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-300"
                >
                  {name}
                  {info.count > 1 && (
                    <span className="text-emerald-300/70">×{info.count}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-white/10">
          <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1">
            {t("lightbox.detailFavorite")}
          </p>
          <p
            className={cn(
              "inline-flex items-center gap-1.5 text-sm",
              media.isFavorite ? "text-rose-400" : "text-white/60",
            )}
          >
            <Heart
              size={14}
              className={media.isFavorite ? "fill-rose-400" : ""}
            />
            {media.isFavorite
              ? t("lightbox.detailFavoriteYes")
              : t("lightbox.detailFavoriteNo")}
          </p>
        </div>
      </div>
    </div>
  );
};
