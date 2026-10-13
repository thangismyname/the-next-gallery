import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CategoryGrid } from "@/features/categories";
import {
  fetchAlbumCovers,
  fetchFavorites,
  fetchMedia,
} from "@/services/media";
import type { Category } from "@/types";

export const HomeView: React.FC = () => {
  // Ảnh mới nhất (All Photos + Recent)
  const { data: recentData } = useQuery({
    queryKey: ["home", "recent-media"],
    queryFn: () => fetchMedia(0, 4),
    staleTime: 120_000,
  });

  // Ảnh đại diện từ đúng nguồn mỗi category — không có data thì card không ảnh.
  const { data: favData } = useQuery({
    queryKey: ["home", "favorites"],
    queryFn: () => fetchFavorites(0, 4),
    staleTime: 120_000,
  });

  const { data: albumData } = useQuery({
    queryKey: ["home", "album-covers"],
    queryFn: () => fetchAlbumCovers(20),
    staleTime: 120_000,
  });

  const recentCovers: string[] = (recentData?.items ?? [])
    .filter((item) => item.thumbnailUrl)
    .slice(0, 4)
    .map((item) => item.thumbnailUrl);

  const favCover = favData?.items?.[0]?.thumbnailUrl;
  const albumCover = albumData?.items?.[0]?.coverUrl ?? undefined;

  const categories: Category[] = [
    {
      id: "all",
      label: "All Photos",
      description: "Browse your entire collection",
      href: "/gallery",
      coverUrl: recentCovers[0],
    },
    {
      id: "recent",
      label: "Recent",
      description: "Latest uploads",
      href: "/gallery?sort=recent",
      coverUrl: recentCovers[1],
    },
    {
      id: "favorites",
      label: "Favorites",
      description: "Your starred photos",
      href: "/gallery?filter=favorites",
      coverUrl: favCover,
    },
    {
      id: "albums",
      label: "Albums",
      description: "Organized collections",
      href: "/albums",
      coverUrl: albumCover,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8">
      <section>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          The Next Gallery
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AI-powered photo management
        </p>
      </section>

      <section>
        <CategoryGrid categories={categories} columns={2} />
      </section>
    </div>
  );
};