import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Clock3 } from "lucide-react";
import { fetchMedia, type GallerySort } from "@/services/media";
import { galleryQueryPrefix } from "@/hooks/useGalleryMedia";

// Nút truy cập Moments bên phải nút chụp — hiển thị ảnh vừa mới chụp/lưu nhất.
// Query dùng chung prefix gallery nên khi capture save (invalidate galleryQueryPrefix)
// thumbnail trên nút tự cập nhật.
const SHORTCUT_SORT: GallerySort = "newest";

const CaptureMomentsShortcut: React.FC<{ disabled?: boolean }> = ({
  disabled = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: [...galleryQueryPrefix, 1, SHORTCUT_SORT],
    queryFn: () => fetchMedia(0, 1, SHORTCUT_SORT),
    staleTime: 30_000,
  });

  const latest = data?.items?.[0];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => navigate("/moments")}
      className="absolute left-full top-1/2 ml-7 flex -translate-y-1/2 flex-col items-center gap-1.5 disabled:opacity-40"
      aria-label={t("capture.moments")}
      title={t("capture.moments")}
    >
      <span className="block size-13 overflow-hidden rounded-full border-2 border-white/30 bg-white/10 shadow-lg">
        {latest?.thumbnailUrl ? (
          <img
            src={latest.thumbnailUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-white/60">
            <Clock3 className="size-5" />
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium tracking-wide text-white/70">
        {t("capture.moments")}
      </span>
    </button>
  );
};

export default CaptureMomentsShortcut;