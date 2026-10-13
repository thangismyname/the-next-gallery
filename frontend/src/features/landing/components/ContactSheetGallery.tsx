// src/features/landing/components/ContactSheetGallery.tsx
import { useTranslation } from "react-i18next";

type Frame = {
  id: string;
  src: string;
  objects: number;
  status: "done" | "processing";
};

// Tự động lấy tất cả ảnh trong thư mục, key là đường dẫn file
const imageModules = import.meta.glob("../../../assets/images/image_*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function getImageSrc(filename: string) {
  const entry = Object.entries(imageModules).find(([path]) =>
    path.endsWith(filename),
  );
  return entry?.[1] ?? "";
}

// fileNumber = số thực tế trong tên file (1, 2, 3... không có số 0 đứng đầu)
// id = chuỗi hiển thị trên UI (#01, #02...)
const FRAME_META: {
  id: string;
  fileNumber: number;
  objects: number;
  status: Frame["status"];
}[] = [
  { id: "01", fileNumber: 1, objects: 3, status: "done" },
  { id: "02", fileNumber: 2, objects: 1, status: "done" },
  { id: "03", fileNumber: 3, objects: 5, status: "processing" },
  { id: "04", fileNumber: 4, objects: 2, status: "done" },
  { id: "05", fileNumber: 5, objects: 4, status: "done" },
  { id: "06", fileNumber: 6, objects: 1, status: "done" },
];

const FRAMES: Frame[] = FRAME_META.map(({ fileNumber, ...meta }) => ({
  ...meta,
  src: getImageSrc(`image_${fileNumber}.jpg`),
})).filter((frame) => frame.src !== ""); // loại bỏ frame nếu không tìm thấy ảnh

// 8 ô, xen kẽ: true = có ảnh (lấy theo thứ tự FRAMES), false = ô trống
const SLOT_PATTERN = [true, false, true, true, false, true, true, false];

export function ContactSheetGallery() {
  const { t } = useTranslation();
  let frameCursor = 0;

  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-2 gap-px bg-border/60 md:grid-cols-4">
          {SLOT_PATTERN.map((hasFrame, slotIndex) => {
            if (!hasFrame) {
              return (
                <div
                  key={`empty-${slotIndex}`}
                  className="relative aspect-4/5 bg-background"
                >
                  <div className="absolute inset-3 border border-dashed border-border/40" />
                </div>
              );
            }

            const frame = FRAMES[frameCursor];
            frameCursor += 1;
            if (!frame) return null;

            return (
              <figure key={frame.id} className="group relative bg-background">
                <div className="aspect-4/5 overflow-hidden">
                  <img
                    src={frame.src}
                    alt=""
                    className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                  />
                </div>
                <figcaption className="flex items-center justify-between px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>#{frame.id}</span>
                  <span
                    className={frame.status === "done" ? "text-(--copper)" : ""}
                  >
                    {frame.status === "done"
                      ? t("gallery.objectsFound", "{{count}} vật thể", {
                          count: frame.objects,
                        })
                      : t("gallery.processing")}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
