import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchFavorites, toMedia } from "@/services/media";
import { useGalleryActions } from "@/hooks/useGalleryActions";
import { ImageCard } from "@/features/gallery/components/ImageCard";
import { Lightbox } from "@/features/gallery/components/Lightbox";

const favoritesQueryKey = ["favorites", "media"] as const;

export const FavoritesView: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: favoritesQueryKey,
    queryFn: () => fetchFavorites(0, 1000),
    staleTime: 30_000,
  });

  const items = useMemo(
    () => (data?.items ?? []).map(toMedia),
    [data],
  );

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const currentMedia = selectedIndex !== null ? items[selectedIndex] : null;

  const { handleDelete, handleFavorite } = useGalleryActions();

  const toggleFavorite = async (mediaId: string) => {
    await handleFavorite([mediaId], false);
    queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
    queryClient.invalidateQueries({ queryKey: ["home", "favorites"] });
    setSelectedIndex(null);
  };

  const deleteFromLightbox = (id: string) => {
    setSelectedIndex(null);
    handleDelete([id]);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
          <Heart className="size-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {t("favorites.title")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("favorites.subtitle", { count: String(items.length) })}
          </p>
        </div>
        {isFetching && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      {isPending ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <p className="text-sm">{t("gallery.error.loadFailed")}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("trash.retry")}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
          <Heart className="size-10 text-muted-foreground/40" />
          <p className="text-sm">{t("favorites.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {items.map((media) => (
            <ImageCard
              key={media.id}
              media={media}
              onClick={(m) => setSelectedIndex(items.findIndex((x) => x.id === m.id))}
            />
          ))}
        </div>
      )}

      {/* Lightbox xem ảnh lớn */}
      {currentMedia && (
        <Lightbox
          media={currentMedia}
          mediaList={items}
          onClose={() => setSelectedIndex(null)}
          onPrev={selectedIndex! > 0 ? () => setSelectedIndex(selectedIndex! - 1) : undefined}
          onNext={selectedIndex! < items.length - 1 ? () => setSelectedIndex(selectedIndex! + 1) : undefined}
          onSelect={setSelectedIndex}
          onToggleFavorite={() => void toggleFavorite(currentMedia.id)}
          onDelete={() => deleteFromLightbox(currentMedia.id)}
        />
      )}
    </div>
  );
};