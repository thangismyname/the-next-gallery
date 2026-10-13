import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import type { CaptureError } from "@/types";

const CaptureErrorPanel: React.FC<{
  error: CaptureError;
  onRetry: () => void;
}> = ({ error, onRetry }) => {
  const { t } = useTranslation();
  const denied = error === "denied";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-white/10 text-red-400">
        <RotateCcw className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">
          {t(denied ? "capture.permissionDenied" : "capture.unsupported")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(denied ? "capture.permissionDeniedHint" : "capture.unsupportedHint")}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
      >
        <RotateCcw className="size-4" />
        {t("capture.retry")}
      </button>
    </div>
  );
};

export default CaptureErrorPanel;