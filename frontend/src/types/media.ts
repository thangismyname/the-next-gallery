export interface MediaMetadata {
  camera?: string;
  focalLength?: string;
  iso?: number;
  aperture?: string;
  takenAt?: string;
}

export interface Media {
  altText: string;
  id: string;
  title: string | null;
  url: string;
  thumbnailUrl: string;
  thumbnailUrlLarge?: string;
  width: number;
  height: number;
  mediaType: "photo" | "video";
  durationSeconds?: number | null;
  sizeBytes?: number;
  isFavorite?: boolean;
  createdAt?: string | null;
  aiTags: string[];
  metadata?: MediaMetadata;
}

export interface SearchResultItem {
  id: string;
  thumbnailUrl: string;
  filename: string;
  score: number; // độ tương đồng cosine từ CLIP embedding
}

export interface UploadProgress {
  uploadedCount: number; // số file đã upload xong (đầu batch hiện tại)
  totalCount: number; // tổng số file
  currentBatchPercent: number; // % của batch đang chạy (dùng XHR progress)
}

export interface MediaPreview {
  id: string;
  thumbnailUrl: string;
  name: string;
  size: number;
  type: string;
}