import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fitCropBox, formatTimer } from "@/hooks/useCamera";
import {
  RATIO_MAP,
  type AspectRatio,
  type CaptureError,
  type CapturePreview as PreviewData,
} from "@/types";
import CaptureErrorPanel from "./CaptureErrorPanel";
import CapturePreview from "./CapturePreview";

type Props = {
  error: CaptureError | null;
  onRetry: () => void;
  ready: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  vfBoxRef: React.RefObject<HTMLDivElement | null>;
  vfSize: { w: number; h: number };
  aspectRatio: AspectRatio;
  mirror: boolean;
  showGrid: boolean;
  countdown: number;
  recording: boolean;
  timer: number;
  preview: PreviewData | null;
  saved: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
};

const CaptureViewfinder: React.FC<Props> = ({
  error,
  onRetry,
  ready,
  videoRef,
  vfBoxRef,
  vfSize,
  aspectRatio,
  mirror,
  showGrid,
  countdown,
  recording,
  timer,
  preview,
  saved,
  saving,
  onReset,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <div className="relative flex-1 overflow-hidden">
      {error ? (
        <CaptureErrorPanel error={error} onRetry={onRetry} />
      ) : !ready ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-white/60">
          <Loader2 className="size-8 animate-spin" />
          <span className="text-sm">{t("capture.opening")}</span>
        </div>
      ) : (
        <>
          <div
            ref={vfBoxRef}
            className="flex h-full w-full items-center justify-center"
          >
            <div
              className={cn(
                "relative overflow-hidden",
                aspectRatio !== "free" &&
                  "rounded-sm shadow-[0_0_0_100vmax] shadow-black/40",
              )}
              style={
                vfSize.w > 0 && vfSize.h > 0
                  ? {
                      width: fitCropBox(vfSize.w, vfSize.h, RATIO_MAP[aspectRatio]).w,
                      height: fitCropBox(vfSize.w, vfSize.h, RATIO_MAP[aspectRatio]).h,
                    }
                  : { width: "100%", height: "100%" }
              }
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "h-full w-full",
                  aspectRatio === "free" ? "object-contain" : "object-cover",
                  mirror && "-scale-x-100",
                )}
              />

              {/* Viền khung tỉ lệ */}
              {aspectRatio !== "free" && (
                <div className="pointer-events-none absolute inset-0 border-2 border-white/70" />
              )}

              {/* Rule-of-thirds grid — bám theo khung tỉ lệ */}
              {showGrid && (
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/40" />
                  <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/40" />
                  <div className="absolute left-0 right-0 top-1/3 h-px bg-white/40" />
                  <div className="absolute left-0 right-0 top-2/3 h-px bg-white/40" />
                </div>
              )}
            </div>
          </div>

          {/* Countdown */}
          {countdown > 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <span
                key={countdown}
                className="text-8xl font-bold text-white drop-shadow-lg animate-ping"
              >
                {countdown}
              </span>
            </div>
          )}
        </>
      )}

      {!error && ready && recording && (
        <div className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-medium backdrop-blur">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="tabular-nums">{formatTimer(timer)}</span>
            <span className="hidden text-white/70 sm:inline">
              {t("capture.recording")}
            </span>
          </span>
        </div>
      )}

      {/* Preview sau khi chụp/quay */}
      {preview && (
        <CapturePreview
          preview={preview}
          saved={saved}
          saving={saving}
          onReset={onReset}
          onSave={onSave}
        />
      )}
    </div>
  );
};

export default CaptureViewfinder;