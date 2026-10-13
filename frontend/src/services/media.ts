import { Media } from "@/types";
import { API_URL as BASE_URL, AUTH_BASE_URL } from "@/lib/config";

export interface MediaListItem {
  id: string;
  mediaType: "photo" | "video";
  title: string | null;
  url: string;
  thumbnailUrl: string;
  thumbnailUrlLarge?: string;
  width?: number;
  height?: number;
  durationSeconds?: number | null;
  sizeBytes?: number;
  isFavorite: boolean;
  createdAt?: string | null;
  aiTags: string[];
  score?: number | null;
}

export interface TrashItem extends MediaListItem {
  deletedAt: string;
}

export interface MediaPage {
  items: MediaListItem[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface AlbumCover {
  id: string;
  name: string;
  coverUrl: string | null;
}

export interface AlbumSearchResult {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  mediaCount: number;
}

export function resolveMediaUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  return `${AUTH_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function mapMediaItem(item: Record<string, unknown>): MediaListItem {
  return {
    ...item,
    isFavorite: Boolean(item.isFavorite),
    createdAt: (item.createdAt as string | null) ?? null,
    url: resolveMediaUrl(item.url as string | undefined),
    thumbnailUrl: resolveMediaUrl(
      (item.thumbnailUrl as string | undefined) ||
        (item.url as string | undefined),
    ),
    thumbnailUrlLarge: (item.thumbnailUrlLarge as string | undefined)
      ? resolveMediaUrl(item.thumbnailUrlLarge as string)
      : undefined,
  } as MediaListItem;
}

// Chuyển MediaListItem → Media (thêm các trường bắt buộc: altText, width/height mặc định).
// Dùng khi đưa item vào components yêu cầu kiểu Media đầy đủ (ImageCard, Lightbox).
export function toMedia(item: MediaListItem): Media {
  return {
    ...item,
    altText: item.title ?? "Gallery photo",
    width: item.width ?? 800,
    height: item.height ?? 600,
  };
}

export type GallerySort = "newest" | "oldest" | "name_asc" | "name_desc";

/** Bộ lọc cho media picker (dialog chọn ảnh). */
export type MediaFilter = "all" | "favorites" | "photos" | "videos";

export const fetchMedia = async (
  offset = 0,
  limit = 40,
  sort?: GallerySort,
): Promise<MediaPage> => {
  try {
    const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (sort) params.set("sort", sort);
    const response = await fetch(
      `${BASE_URL}/gallery/media?${params.toString()}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    const data = json.data ?? json;

    const items: MediaListItem[] = (Array.isArray(data.items) ? data.items : []).map(
      (item: { url: string | undefined; thumbnailUrl: any; thumbnailUrlLarge: string | undefined; }) =>
        mapMediaItem(item as Record<string, unknown>),
    );

    return {
      items,
      hasMore: Boolean(data.hasMore),
      limit: data.limit ?? limit,
      offset: data.offset ?? offset,
    };
  } catch (error) {
    console.error("Failed to fetch media from API:", error);
    return {
      items: [],
      hasMore: false,
      limit,
      offset,
    };
  }
};

export const uploadMedia = async (files: File[]): Promise<string[]> => {
  const formData = new FormData();
  files.forEach((file) => formData.append("media", file));

  const response = await fetch(`${BASE_URL}/gallery/media`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  const uploaded = (json.data?.uploaded ?? []) as { id: string }[];
  return uploaded.map((item) => item.id);
};

export const fetchFavorites = async (
  offset = 0,
  limit = 40,
): Promise<MediaPage> => {
  const response = await fetch(
    `${BASE_URL}/gallery/media/favorites?offset=${offset}&limit=${limit}`,
    {
      credentials: "include",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  const data = json.data ?? json;

  const items: MediaListItem[] = (Array.isArray(data.items) ? data.items : []).map(
    (item: Record<string, unknown>) => mapMediaItem(item),
  );

  return {
    items,
    hasMore: Boolean(data.hasMore),
    limit: data.limit ?? limit,
    offset: data.offset ?? offset,
  };
};

/**
 * Lấy media theo bộ lọc cho picker ảnh: tất cả / yêu thích / ảnh / video.
 * - favorites → dùng endpoint chuyên biệt.
 * - photos/videos → truyền type filter, phân trang sạch ở server.
 */
export const fetchMediaByFilter = async (
  filter: MediaFilter,
  offset = 0,
  limit = 100,
): Promise<MediaPage> => {
  const response = await fetch(
    filter === "favorites"
      ? `${BASE_URL}/gallery/media/favorites?offset=${offset}&limit=${limit}`
      : `${BASE_URL}/gallery/media?${new URLSearchParams({
          offset: String(offset),
          limit: String(limit),
          ...(filter === "photos" || filter === "videos"
            ? { type: filter === "photos" ? "photo" : "video" }
            : {}),
        }).toString()}`,
    {
      credentials: "include",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  const data = json.data ?? json;

  const items: MediaListItem[] = (Array.isArray(data.items) ? data.items : []).map(
    (item: Record<string, unknown>) => mapMediaItem(item),
  );

  return {
    items,
    hasMore: Boolean(data.hasMore),
    limit: data.limit ?? limit,
    offset: data.offset ?? offset,
  };
};

export const fetchAlbumCovers = async (
  limit = 20,
): Promise<{ items: AlbumCover[] }> => {
  try {
    const response = await fetch(
      `${BASE_URL}/gallery/media/albums?offset=0&limit=${limit}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    const data = json.data ?? json;

    const items: AlbumCover[] = (Array.isArray(data.items) ? data.items : []).map(
      (item: { id: string; name: string; coverUrl: string | null }) => ({
        id: item.id,
        name: item.name,
        coverUrl: item.coverUrl ? resolveMediaUrl(item.coverUrl) : null,
      }),
    );

    return { items };
  } catch (error) {
    console.error("Failed to fetch album covers from API:", error);
    return { items: [] };
  }
};

export const searchGallerySemantic = async (
  query: string,
  signal?: AbortSignal,
): Promise<MediaListItem[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/gallery/media/search?q=${encodeURIComponent(query)}`,
      { signal, credentials: "include" },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const items: MediaListItem[] = (Array.isArray(data.data) ? data.data : []).map(
      (item: Record<string, unknown>) => mapMediaItem(item),
    );
    return items;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw error;
    }
    console.error("Failed to search gallery:", error);
    return [];
  }
};

export interface ObjectDetection {
  class_name: string;
  confidence: number;
  bbox: number[];
  model: string;
}

export interface ObjectClass {
  class_name: string;
  count: number;
}

export interface DetectionStats {
  total: number;
  detected: number;
  pending: number;
}

/** Tìm ảnh theo ĐỐI TƯỢNG (YOLO26 — class COCO) cho Spotlight. */
export const searchGalleryObjects = async (
  query: string,
  signal?: AbortSignal,
): Promise<MediaListItem[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/gallery/media/objects/search?q=${encodeURIComponent(query)}`,
      { signal, credentials: "include" },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return (Array.isArray(data.data) ? data.data : []).map(
      (item: Record<string, unknown>) => mapMediaItem(item),
    );
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw error;
    }
    console.error("Failed to search objects:", error);
    return [];
  }
};

/** Danh sách class đã phát hiện (kèm số ảnh) — gợi ý cho ô search. */
export const fetchObjectClasses = async (): Promise<
  { class_name: string; count: number }[]
> => {
  try {
    const response = await fetch(`${BASE_URL}/gallery/media/objects/classes`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch (error) {
    console.error("Failed to fetch object classes:", error);
    return [];
  }
};

/** Detection (kèm bbox) của 1 ảnh — dùng cho Developer Mode overlay. */
export const fetchMediaDetections = async (
  mediaId: string,
): Promise<ObjectDetection[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/gallery/media/${mediaId}/detections`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch (error) {
    console.error("Failed to fetch media detections:", error);
    return [];
  }
};

export const searchAlbums = async (
  query: string,
  signal?: AbortSignal,
): Promise<AlbumSearchResult[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/gallery/media/albums/search?q=${encodeURIComponent(query)}`,
      { signal, credentials: "include" },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const items: AlbumSearchResult[] = (Array.isArray(data.data) ? data.data : []).map(
      (item: { id: string; name: string; description: string; coverUrl: string | null; mediaCount: number }) => ({
        id: item.id,
        name: item.name,
        description: item.description || "",
        coverUrl: item.coverUrl ? resolveMediaUrl(item.coverUrl) : null,
        mediaCount: item.mediaCount,
      }),
    );
    return items;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw error;
    }
    console.error("Failed to search albums:", error);
    return [];
  }
};

// ================= THÙNG RÁC =================

export const fetchTrash = async (
  offset = 0,
  limit = 100,
): Promise<MediaPage> => {
  try {
    const response = await fetch(
      `${BASE_URL}/gallery/media/trash?offset=${offset}&limit=${limit}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    const data = json.data ?? json;

    const items: TrashItem[] = (Array.isArray(data.items) ? data.items : []).map(
      (item) =>
        ({ ...mapMediaItem(item), deletedAt: item.deletedAt }) as TrashItem,
    );

    return {
      items,
      hasMore: Boolean(data.hasMore),
      limit: data.limit ?? limit,
      offset: data.offset ?? offset,
    };
  } catch (error) {
    console.error("Failed to fetch trash from API:", error);
    return { items: [], hasMore: false, limit, offset };
  }
};

export const setFavorite = async (
  ids: string[],
  favorite: boolean,
): Promise<void> => {
  const response = await fetch(`${BASE_URL}/gallery/media/favorite`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, favorite }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
};

export const moveToTrash = async (ids: string[]): Promise<void> => {
  const response = await fetch(`${BASE_URL}/gallery/media/trash`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
};

export const restoreMedia = async (ids: string[]): Promise<void> => {
  const response = await fetch(`${BASE_URL}/gallery/media/restore`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
};

export const permanentDeleteMedia = async (ids: string[]): Promise<void> => {
  const response = await fetch(`${BASE_URL}/gallery/media/trash/permanent`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
};