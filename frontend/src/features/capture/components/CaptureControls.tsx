import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, Image as ImageIcon, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_DURATION, type CaptureMode, type TimerOption } from "@/types";
import CaptureMomentsShortcut from "./CaptureMomentsShortcut";

type Props = {
  mode: CaptureMode;
  onModeChange: (mode: CaptureMode) => void;
  recording: boolean;
  countdown: number;
  timerDelay: TimerOption;
  timer: number;
  onFlip: () => void;
  onShutterDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onShutterUp: () => void;
  onShutterCancel: () => void;
};

const CaptureControls: React.FC<Props> = ({
  mode,
  onModeChange,
  recording,
  countdown,
  timerDelay,
  timer,
  onFlip,
  onShutterDown,
  onShutterUp,
  onShutterCancel,
}) => {
  const { t } = useTranslation();
  const disabled = recording || countdown > 0;

  return (
    <div className="flex shrink-0 flex-col items-center gap-4 pb-8 pt-4">
      <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange("photo")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition",
            mode === "photo"
              ? "bg-white text-black"
              : "text-white/70 hover:text-white",
            disabled && "opacity-40",
          )}
        >
          <ImageIcon className="size-4" />
          {t("capture.photoMode")}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange("video")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition",
            mode === "video"
              ? "bg-white text-black"
              : "text-white/70 hover:text-white",
            disabled && "opacity-40",
          )}
        >
          <Video className="size-4" />
          {t("capture.videoMode")}
        </button>
      </div>

      <p className="text-xs text-white/60">
        {countdown > 0
          ? t("capture.countdownHint")
          : mode === "photo"
            ? timerDelay > 0
              ? t("capture.hintPhotoTimer", { seconds: timerDelay })
              : t("capture.hintPhoto")
            : t("capture.hintVideo")}
      </p>

      <div className="relative">
        {/* Lật camera — canh theo nút chụp */}
        <button
          type="button"
          onClick={onFlip}
          disabled={disabled}
          className="absolute right-full top-1/2 mr-8 grid size-13 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white disabled:opacity-40"
          aria-label={t("capture.flip")}
          title={t("capture.flip")}
        >
          <ArrowLeftRight className="size-6" />
        </button>

        {/* Truy cập Moments — bên phải nút chụp, hiện ảnh vừa chụp nhất */}
        <CaptureMomentsShortcut disabled={disabled} />

        <button
          type="button"
          className="relative touch-none select-none outline-none"
          onPointerDown={onShutterDown}
          onPointerUp={onShutterUp}
          onPointerCancel={onShutterCancel}
          aria-label={
            mode === "photo" ? t("capture.photoMode") : t("capture.videoMode")
          }
        >
          <span
            className={cn(
              "block size-20 rounded-full border-4 transition-colors",
              recording ? "border-white/80" : "border-white/40",
            )}
          />
          <span
            className={cn(
              "absolute inset-3 grid place-items-center overflow-hidden rounded-full bg-white/90 transition-colors",
              recording && "bg-red-600",
            )}
          >
            {recording ? (
              <span className="size-6 animate-pulse rounded-lg bg-white" />
            ) : (
              <span className="size-9 rounded-full bg-white shadow-inner" />
            )}
          </span>
          {/* Progress ring quay video (tối đa MAX_DURATION giây) */}
          {mode === "video" && recording && (
            <svg
              className="absolute inset-0 size-20 -rotate-90"
              viewBox="0 0 80 80"
              aria-hidden
            >
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="226.19"
                strokeDashoffset={String(
                  226.19 * (1 - Math.min(timer, MAX_DURATION) / MAX_DURATION),
                )}
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default CaptureControls;
