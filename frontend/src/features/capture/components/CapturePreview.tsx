import { useTranslation } from "react-i18next";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CapturePreview as PreviewData } from "@/types";

type Props = {
  preview: PreviewData;
  saved: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
};

const CapturePreview: React.FC<Props> = ({
  preview,
  saved,
  saving,
  onReset,
  onSave,
}) => {
  const { t } = useTranslation();
  const isVideo = preview.kind === "video";

  return (
    <div className={cn("absolute inset-0 z-10 flex flex-col bg-black")}>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pt-2">
        {isVideo ? (
          <video
            src={preview.url}
            autoPlay
            loop
            playsInline
            controls
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        ) : (
          <img
            src={preview.url}
            alt={t("capture.title")}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        )}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-6 p-6">
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="grid size-14 place-items-center rounded-full border-2 border-white/40 text-white/80 transition hover:border-white/80 hover:text-white disabled:opacity-40"
          aria-label={t("capture.retake")}
          title={t("capture.retake")}
        >
          <X className="size-6" />
        </button>
        {saved ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-6 py-3 font-medium text-emerald-300">
            <Check className="size-5" />
            {t("capture.saved")}
          </span>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Check className="size-5" />
            )}
            {saving ? t("capture.saving") : t("capture.save")}
          </button>
        )}
      </div>
    </div>
  );
};

export default CapturePreview;