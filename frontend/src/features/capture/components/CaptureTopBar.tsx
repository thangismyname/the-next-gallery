import { useTranslation } from "react-i18next";
import { Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onBack: () => void;
  showSettings: boolean;
  disabled: boolean;
  onToggleSettings: () => void;
};

const CaptureTopBar: React.FC<Props> = ({
  onBack,
  showSettings,
  disabled,
  onToggleSettings,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-14 shrink-0 items-center justify-between px-4">
      <button
        type="button"
        onClick={onBack}
        className="grid size-10 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
        aria-label={t("capture.back")}
      >
        <X className="size-5" />
      </button>
      <span className="text-sm font-semibold tracking-wide">
        {t("capture.title")}
      </span>
      <button
        type="button"
        onClick={onToggleSettings}
        disabled={disabled}
        className={cn(
          "grid size-10 place-items-center rounded-full transition",
          showSettings
            ? "bg-white/20 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white",
          disabled && "opacity-40",
        )}
        aria-label={t("capture.settings")}
        aria-pressed={showSettings}
        title={t("capture.settings")}
      >
        <Settings2 className="size-5" />
      </button>
    </div>
  );
};

export default CaptureTopBar;