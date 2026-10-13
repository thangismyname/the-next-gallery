import React, { memo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Media } from "../../../types";
import { cn } from "@/lib/utils";
import { Check, Video } from "lucide-react";

interface ImageCardProps {
  media: Media;
  onClick?: (media: Media) => void;
  className?: string;
  selected?: boolean;
  onToggle?: (media: Media) => void;
  onLongPress?: (media: Media) => void;
}

export const ImageCard: React.FC<ImageCardProps> = memo(
  ({ media, onClick, className, selected = false, onToggle, onLongPress }) => {
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
      if (!onLongPress) return;
      longPressRef.current.fired = false;
      longPressRef.current.timer = window.setTimeout(() => {
        longPressRef.current.fired = true;
        onLongPress(media);
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
      if (selected || onToggle) {
        onToggle?.(media);
      } else {
        onClick?.(media);
      }
    };

    // srcSet 1 cỡ (bản nhỏ cho grid); nếu có bản lớn thì thêm mốc cho 2x/retina
    const srcSet =
      media.thumbnailUrlLarge && media.thumbnailUrl
        ? `${media.thumbnailUrl} 200w, ${media.thumbnailUrlLarge} 400w`
        : undefined;
    const sizes = srcSet ? `(min-width: 1024px) 25vw, 50vw` : undefined;

    return (
      <Card
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onContextMenu={(e) => {
          if (onLongPress) {
            e.preventDefault();
            onLongPress(media);
          }
        }}
        className={cn(
          "group relative aspect-square overflow-hidden cursor-pointer",
          "border-border/40 bg-muted/30 select-none",
          "transition-all duration-300 hover:shadow-md hover:shadow-primary/5 hover:border-primary/30",
          selected &&
            "border-primary ring-2 ring-primary/60 shadow-lg shadow-primary/20",
          className,
        )}
      >
        <CardContent className="p-0 absolute inset-0">
          {/* Skeleton Shimmer khi ảnh đang tải */}
          {!isLoaded && !hasError && src && (
            <Skeleton className="absolute inset-0 w-full h-full rounded-none bg-muted/60" />
          )}

          {src && !hasError ? (
            <img
              src={src}
              srcSet={srcSet}
              sizes={sizes}
              alt={media.title || "Gallery photo"}
              width={media.width || 200}
              height={media.height || 200}
              loading="lazy"
              decoding="async"
              onLoad={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
              className={cn(
                "absolute inset-0 w-full h-full object-cover object-center block",
                "transition-opacity duration-300 group-hover:scale-[1.03]",
                isLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground bg-muted/50">
              {hasError ? "Lỗi tải ảnh" : "No image"}
            </div>
          )}

          {/* Video Badge */}
          {isVideo && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white p-1 rounded-md">
              <Video className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Selection Overlay */}
          {selected && (
            <div className="absolute inset-0 bg-primary/10 pointer-events-none">
              <div className="absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-md">
                <Check className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Hover Overlay Thông tin */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-end p-2.5 pointer-events-none",
              "bg-linear-to-t from-black/80 via-black/30 to-transparent",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            )}
          >
            <p className="text-xs font-medium text-white truncate">
              {media.title}
            </p>
            {(media.aiTags?.length ?? 0) > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {media.aiTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] bg-primary/20 text-primary-foreground px-1.5 py-0.5 rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
);
