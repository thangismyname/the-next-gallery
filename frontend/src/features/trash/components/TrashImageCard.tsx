import React, { memo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrashItem } from "@/services/media";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, Trash2, Video } from "lucide-react";

interface TrashImageCardProps {
  media: TrashItem;
  selected?: boolean;
  onToggle: (media: TrashItem) => void;
  onRestore: (media: TrashItem) => void;
  onDeleteForever: (media: TrashItem) => void;
  onOpen: (media: TrashItem) => void;
}

export const TrashImageCard: React.FC<TrashImageCardProps> = memo(
  ({ media, selected = false, onToggle, onRestore, onDeleteForever, onOpen }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const src = media.thumbnailUrl || media.url;
    const isVideo = media.mediaType === "video";

    const longPressRef = useRef<{ timer: number | null; fired: boolean }>({
      timer: null,
      fired: false,
    });

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      longPressRef.current.fired = false;
      longPressRef.current.timer = window.setTimeout(() => {
        longPressRef.current.fired = true;
        onToggle(media);
      }, 450);
    };

    const clearLongPress = () => {
      if (longPressRef.current.timer !== null) {
        window.clearTimeout(longPressRef.current.timer);
        longPressRef.current.timer = null;
      }
    };

    const handleClick = () => {
      if (longPressRef.current.fired) {
        longPressRef.current.fired = false;
        return;
      }
      onOpen(media);
    };

    return (
      <Card
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        className={cn(
          "group relative aspect-square overflow-hidden cursor-pointer",
          "border-border/40 bg-muted/30 select-none",
          "transition-all duration-300 hover:shadow-md hover:shadow-primary/5 hover:border-primary/30",
          selected &&
            "border-primary ring-2 ring-primary/60 shadow-lg shadow-primary/20",
        )}
      >
        <CardContent className="p-0 absolute inset-0">
          {!isLoaded && !hasError && src && (
            <Skeleton className="absolute inset-0 w-full h-full rounded-none bg-muted/60" />
          )}

          {src && !hasError ? (
            <img
              src={src}
              alt={media.title || "Trash photo"}
              width={media.width || 200}
              height={media.height || 200}
              loading="lazy"
              decoding="async"
              onLoad={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
              className={cn(
                "absolute inset-0 w-full h-full object-cover object-center block",
                "transition-opacity duration-300",
                isLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground bg-muted/50">
              {hasError ? "Lỗi tải ảnh" : "No image"}
            </div>
          )}

          {isVideo && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white p-1 rounded-md">
              <Video className="w-3.5 h-3.5" />
            </div>
          )}

          {selected && (
            <div className="absolute inset-0 bg-primary/10 pointer-events-none">
              <div className="absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-md">
                <Check className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Hover Overlay — không chặn click (pointer-events-none trên container, nút riêng pointer-events-auto) */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-end p-2 pointer-events-none",
              "bg-gradient-to-t from-black/80 via-black/30 to-transparent",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            )}
          >
            <p className="text-xs font-medium text-white truncate mb-1.5">
              {media.title}
            </p>
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto flex items-center gap-1.5"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore(media);
                }}
                title="Khôi phục"
                className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium py-1.5 hover:bg-primary/90 active:scale-95 transition"
              >
                <RotateCcw className="w-3 h-3" />
                Khôi phục
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteForever(media);
                }}
                title="Xóa vĩnh viễn"
                className="flex items-center justify-center rounded-md bg-red-600/90 text-white p-1.5 hover:bg-red-600 active:scale-95 transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);