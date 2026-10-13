import { useTranslation } from "react-i18next";
import { FlipHorizontal2, Grid3X3, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASPECT_RATIOS, type AspectRatio, type TimerOption } from "@/types";

type Props = {
  aspectRatio: AspectRatio;
  onAspectChange: (ratio: AspectRatio) => void;
  showGrid: boolean;
  onGridToggle: () => void;
  timerDelay: TimerOption;
  onTimerToggle: () => void;
  mirror: boolean;
  onMirrorToggle: () => void;
};

const CaptureSettingsBar: React.FC<Props> = ({
  aspectRatio,
  onAspectChange,
  showGrid,
  onGridToggle,
  timerDelay,
  onTimerToggle,
  mirror,
  onMirrorToggle,
}) => {
  const { t } = useTranslation();

  return (
    <div className="shrink-0 border-t border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
      <div className="flex flex-col items-center gap-2">
        {/* Aspect ratio */}
        <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full bg-white/10 p-1">
          {ASPECT_RATIOS.map(({ value }) => (
            <button
              key={value}
              type="button"
              onClick={() => onAspectChange(value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition",
                aspectRatio === value
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white",
              )}
              aria-pressed={aspectRatio === value}
              title={t(`capture.ratio.${value}`)}
            >
              {value === "free" ? t("capture.ratio.free") : value}
            </button>
          ))}
        </div>

        {/* Grid / Timer / Mirror */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGridToggle}
            className={cn(
              "grid size-9 place-items-center rounded-full transition",
              showGrid
                ? "bg-white/25 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white",
            )}
            aria-pressed={showGrid}
            aria-label={t("capture.grid")}
            title={t("capture.grid")}
          >
            <Grid3X3 className="size-4" />
          </button>

          <button
            type="button"
            onClick={onTimerToggle}
            className={cn(
              "grid size-9 place-items-center rounded-full transition",
              timerDelay > 0
                ? "bg-white/25 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white",
            )}
            aria-pressed={timerDelay > 0}
            aria-label={t("capture.timer")}
            title={t("capture.timer")}
          >
            <span className="relative">
              <Timer className="size-4" />
              {timerDelay > 0 && (
                <span className="absolute -top-1.5 -right-2 text-[9px] font-bold">
                  {timerDelay}s
                </span>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={onMirrorToggle}
            className={cn(
              "grid size-9 place-items-center rounded-full transition",
              mirror
                ? "bg-white/25 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white",
            )}
            aria-pressed={mirror}
            aria-label={t("capture.mirror")}
            title={t("capture.mirror")}
          >
            <FlipHorizontal2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaptureSettingsBar;