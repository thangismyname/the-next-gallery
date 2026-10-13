import { randomUUID } from "crypto";
import path from "path";
import sharp from "sharp";
import { dbPool } from "../config/db.js";
import { minioClient, BUCKET_NAME } from "../config/minio.js";
import {
  embedMediaInBackground,
  semanticSearch,
} from "./embedding.service.js";
import {
  detectMediaInBackground,
  searchByObject,
} from "./detection.service.js";

// Cột dùng chung cho mọi truy vấn danh sách media — 1 nơi duy nhất để bảo trì.
const MEDIA_COLUMNS = `
      id,
      media_type,
      COALESCE(original_filename, CONCAT('Media ', id::text)) AS title,
      width,
      height,
      duration_seconds,
      file_size_kb,
      thumbnail_small_object,
      thumbnail_object,
      is_favorite,
      created_at,
      deleted_at`;

// Whitelist các kiểu sắp xếp → ORDER BY an toàn (không cho dính SQL injection).
const MEDIA_SORT_CLAUSES = {
  newest: "created_at DESC",
  oldest: "created_at ASC",
  name_asc: "COALESCE(original_filename, '') ASC, created_at DESC",
  name_desc: "COALESCE(original_filename, '') DESC, created_at DESC",
};

export async function listMedia(userId, { limit, offset, sort = "newest", type }) {
  const orderBy = MEDIA_SORT_CLAUSES[sort] ?? MEDIA_SORT_CLAUSES.newest;
  const conditions = ["user_id = $1", "deleted_at IS NULL"];
  const params = [userId];
  if (type === "photo" || type === "video") {
    params.push(type);
    conditions.push(`media_type = $${params.length}`);
  }
  params.push(limit, offset);
  const result = await dbPool.query(
    `SELECT ${MEDIA_COLUMNS}
    FROM media
    WHERE ${conditions.join("\n      AND ")}
    ORDER BY ${orderBy}
    LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const items = result.rows.map(toMediaItem);

  return {
    items,
    hasMore: result.rows.length === limit,
    limit,
    offset,
  };
}

function toMediaItem(item) {
  const mediaId = String(item.id);
  const thumbSmall = item.thumbnail_small_object
    ? `/api/gallery/media/${mediaId}/thumbnail?size=small`
    : `/api/gallery/media/${mediaId}/thumbnail?size=med`;
  return {
    id: mediaId,
    mediaType: item.media_type,
    title: item.title,
    url: `/api/gallery/media/${mediaId}/file`,
    thumbnailUrl: thumbSmall,
    thumbnailUrlLarge: `/api/gallery/media/${mediaId}/thumbnail?size=med`,
    width: item.width || 800,
    height: item.height || 600,
    durationSeconds: item.duration_seconds || null,
    sizeBytes: item.file_size_kb ? Number(item.file_size_kb) * 1024 : 0,
    isFavorite: Boolean(item.is_favorite),
    createdAt: item.created_at ?? null,
    deletedAt: item.deleted_at || null,
    aiTags: [],
    score: item.score ?? null,
  };
}

export async function getMediaById(id) {
  const result = await dbPool.query(
    `SELECT id, minio_object, minio_bucket, thumbnail_object, thumbnail_small_object,
            mime_type, updated_at, created_at
     FROM media WHERE id = $1`,
    [id],
  );

  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function getThumbnailInfo(id, size) {
  const item = await getMediaById(id);
  if (!item) return null;

  const bucket = item.minio_bucket || BUCKET_NAME;

  let objectToStream;
  let isWebp = false;
  if (size === "small" && item.thumbnail_small_object) {
    objectToStream = item.thumbnail_small_object;
    isWebp = true;
  } else if (item.thumbnail_object) {
    objectToStream = item.thumbnail_object;
    isWebp = true;
  } else {
    objectToStream = item.minio_object;
  }

  if (!objectToStream) return null;

  const timestamp = new Date(item.updated_at || item.created_at).getTime();
  const etag = `W/"thumb-${size}-${id}-${timestamp}"`;

  return { bucket, objectToStream, isWebp, etag, mime: item.mime_type };
}

export async function getFileInfo(id) {
  const item = await getMediaById(id);
  if (!item) return null;

  const bucket = item.minio_bucket || BUCKET_NAME;
  const objectToStream = item.minio_object;

  if (!objectToStream) return null;

  const timestamp = new Date(item.updated_at || item.created_at).getTime();
  const etag = `W/"file-${id}-${timestamp}"`;

  return { bucket, objectToStream, etag, mime: item.mime_type };
}

export async function createMediaStream(bucket, objectName) {
  return minioClient.getObject(bucket, objectName);
}

export async function uploadMedia(userId, files) {
  const uploaded = [];

  for (const file of files) {
    const ext = path.extname(file.originalname) || "";
    const objectName = `${userId}/${randomUUID()}${ext}`;
    const mediaType = file.mimetype.startsWith("video/") ? "video" : "photo";

    await minioClient.putObject(BUCKET_NAME, objectName, file.buffer, file.size, {
      "Content-Type": file.mimetype,
    });

    let thumbnailObject = null;
    let thumbnailSmallObject = null;
    let width = null;
    let height = null;
    // Buffer dùng để tạo embedding — ưu tiên thumbnail (nhỏ, nhanh) thay vì
    // file gốc cỡ lớn. Gán lại bên dưới khi tạo được thumbnail.
    let embedBuffer = file.buffer;

    if (mediaType === "photo") {
      try {
        const meta = await sharp(file.buffer).metadata();
        width = meta.width || null;
        height = meta.height || null;

        const thumbBuffer = await sharp(file.buffer)
          .rotate()
          .resize(400, 400, { fit: "cover", position: "centre" })
          .webp({ quality: 80 })
          .toBuffer();

        embedBuffer = thumbBuffer;

        thumbnailObject = `${userId}/thumbs/${randomUUID()}.webp`;
        await minioClient.putObject(
          BUCKET_NAME,
          thumbnailObject,
          thumbBuffer,
          thumbBuffer.length,
          { "Content-Type": "image/webp" },
        );

        const thumbSmallBuffer = await sharp(file.buffer)
          .rotate()
          .resize(200, 200, { fit: "cover", position: "centre" })
          .webp({ quality: 80 })
          .toBuffer();

        thumbnailSmallObject = `${userId}/thumbs/${randomUUID()}.webp`;
        await minioClient.putObject(
          BUCKET_NAME,
          thumbnailSmallObject,
          thumbSmallBuffer,
          thumbSmallBuffer.length,
          { "Content-Type": "image/webp" },
        );
      } catch (thumbErr) {
        console.error("Lỗi tạo thumbnail:", thumbErr);
      }
    }

    const result = await dbPool.query(
      `INSERT INTO media
        (user_id, media_type, original_filename, minio_object, minio_bucket,
         thumbnail_object, thumbnail_small_object, width, height,
         file_ext, mime_type, file_size_kb, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
RETURNING id, media_type,
                  COALESCE(original_filename, CONCAT('Media ', id::text)) AS title,
                  width, height, duration_seconds, file_size_kb,
                  thumbnail_object, thumbnail_small_object, created_at, deleted_at`,
      [
        userId,
        mediaType,
        file.originalname,
        objectName,
        BUCKET_NAME,
        thumbnailObject,
        thumbnailSmallObject,
        width,
        height,
        ext.replace(".", ""),
        file.mimetype,
        Math.round(file.size / 1024),
      ],
    );

    const mediaRow = result.rows[0];

    // Semantic search: tạo embedding CLIP chạy NỀN — không chặn response upload.
    // Lỗi AI service sẽ chỉ log, upload vẫn thành công. Ưu tiên embed thumbnail.
    if (mediaType === "photo") {
      embedMediaInBackground({
        mediaId: String(mediaRow.id),
        userId,
        buffer: embedBuffer,
      });
      // Object detection (YOLO26) cũng chạy nền song song.
      detectMediaInBackground({
        mediaId: String(mediaRow.id),
        userId,
        buffer: embedBuffer,
      });
    }

    uploaded.push(toMediaItem(mediaRow));
  }

  return uploaded;
}

export async function softDeleteMedia(userId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };

  const result = await dbPool.query(
    `UPDATE media
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE user_id = $1
       AND id = ANY($2::uuid[])
       AND deleted_at IS NULL
     RETURNING id`,
    [userId, ids],
  );

  return { count: result.rowCount };
}

export async function listTrash(userId, { limit, offset }) {
  const result = await dbPool.query(
    `SELECT ${MEDIA_COLUMNS}
    FROM media
    WHERE user_id = $1
      AND deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  const items = result.rows.map(toMediaItem);

  return {
    items,
    hasMore: result.rows.length === limit,
    limit,
    offset,
  };
}

export async function listFavorites(userId, { limit, offset }) {
  const result = await dbPool.query(
    `SELECT ${MEDIA_COLUMNS}
    FROM media
    WHERE user_id = $1
      AND deleted_at IS NULL
      AND is_favorite = true
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return {
    items: result.rows.map(toMediaItem),
    hasMore: result.rows.length === limit,
    limit,
    offset,
  };
}

export async function setFavorite(userId, ids, favorite) {
  if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };

  const result = await dbPool.query(
    `UPDATE media
     SET is_favorite = $3, updated_at = NOW()
     WHERE user_id = $1
       AND id = ANY($2::uuid[])
       AND deleted_at IS NULL
     RETURNING id`,
    [userId, ids, favorite],
  );

  return { count: result.rowCount };
}

// Lấy media theo danh sách id, giữ đúng thứ tự `ids` (kết quả semantic search
// đã xếp hạng sẵn theo độ tương đồng).
async function getMediaItemsByIds(userId, ids) {
  if (ids.length === 0) return [];
  const result = await dbPool.query(
    `SELECT ${MEDIA_COLUMNS}
     FROM media
     WHERE user_id = $1
       AND deleted_at IS NULL
       AND id = ANY($2::uuid[])`,
    [userId, ids],
  );
  const byId = new Map(result.rows.map((row) => [String(row.id), row]));
  return ids
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map(toMediaItem);
}

// Tìm ảnh cho Spotlight search.
// Ưu tiên semantic search (CLIP embedding + pgvector): tìm theo NGỮ NGHĨA nội
// dung ảnh (vd "chó trên bãi biển"). Nếu ai-service không khả dụng hoặc chưa có
// embedding nào → fallback tìm theo tên file như cũ.
export async function searchMedia(userId, query) {
  try {
    const { hits, hadEmbeddings } = await semanticSearch(userId, query, 20);
    // Có embedding trong DB → tin kết quả semantic (có thể rỗng nếu dưới ngưỡng).
    // Chỉ fallback tìm tên file khi user chưa có embedding nào.
    if (hadEmbeddings) {
      const scoreById = new Map(hits.map((hit) => [hit.id, hit.score]));
      const items = await getMediaItemsByIds(
        userId,
        hits.map((hit) => hit.id),
      );
      return items.map((item) => ({
        ...item,
        score: scoreById.get(item.id) ?? null,
      }));
    }
  } catch (err) {
    console.warn(`⚠️  Semantic search lỗi, fallback tên file: ${err.message}`);
  }

  const result = await dbPool.query(
    `SELECT ${MEDIA_COLUMNS}
     FROM media
     WHERE user_id = $1
       AND deleted_at IS NULL
       AND (original_filename ILIKE $2)
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId, `%${query}%`],
  );

  return result.rows.map(toMediaItem);
}

// Tìm ảnh theo ĐỐI TƯỢNG (YOLO26) cho Spotlight — khớp class_name.
// Trả MediaListItem kèm `score` (confidence cao nhất) giống semantic search.
export async function searchMediaObjects(userId, query, { limit = 20 } = {}) {
  const hits = await searchByObject(userId, query, { limit });
  const scoreById = new Map(hits.map((hit) => [hit.id, hit.score]));
  const items = await getMediaItemsByIds(
    userId,
    hits.map((hit) => hit.id),
  );
  return items.map((item) => ({
    ...item,
    score: scoreById.get(item.id) ?? null,
  }));
}

// Tìm album theo tên — dùng cho Spotlight search
export async function searchAlbums(userId, query) {
  const result = await dbPool.query(
    `SELECT id, name, description, cover_media_id
     FROM albums
     WHERE user_id = $1
       AND (name ILIKE $2 OR description ILIKE $2)
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId, `%${query}%`],
  );

  const albums = result.rows;
  if (albums.length === 0) return [];

  const coverIds = albums
    .filter((a) => a.cover_media_id !== null)
    .map((a) => a.cover_media_id);

  const coverMap = new Map();
  if (coverIds.length > 0) {
    const coverResult = await dbPool.query(
      `SELECT id, thumbnail_small_object
       FROM media WHERE id = ANY($1::uuid[])`,
      [coverIds],
    );
    for (const row of coverResult.rows) {
      coverMap.set(String(row.id), row.thumbnail_small_object);
    }
  }

  const missingCoverIds = albums
    .filter((a) => a.cover_media_id === null)
    .map((a) => a.id);

  const latestByAlbum = new Map();
  if (missingCoverIds.length > 0) {
    const latestResult = await dbPool.query(
      `SELECT DISTINCT ON (am.album_id)
         am.album_id, m.id AS media_id, m.thumbnail_small_object
       FROM album_media am
       JOIN media m ON m.id = am.media_id
       WHERE am.album_id = ANY($1::uuid[])
       ORDER BY am.album_id, m.created_at DESC`,
      [missingCoverIds],
    );
    for (const row of latestResult.rows) {
      latestByAlbum.set(String(row.album_id), row);
    }
  }

  const countResult = await dbPool.query(
    `SELECT album_id, COUNT(*)::int AS media_count
     FROM album_media
     WHERE album_id = ANY($1::uuid[])
     GROUP BY album_id`,
    [albums.map((a) => a.id)],
  );
  const countMap = new Map(countResult.rows.map((r) => [String(r.album_id), r.media_count]));

  return albums.map((a) => {
    const id = String(a.id);
    const coverThumb = coverMap.get(id);
    const latest = latestByAlbum.get(id);
    const thumbObj = coverThumb || latest?.thumbnail_small_object;
    return {
      id,
      name: a.name,
      description: a.description || "",
      coverUrl: thumbObj
        ? `/api/gallery/media/${coverThumb ? String(a.cover_media_id) : String(latest.media_id)}/thumbnail?size=med`
        : null,
      mediaCount: countMap.get(id) || 0,
    };
  });
}

// Danh sách album kèm ảnh đại diện — dùng cho category cards trên Home.
// Cover ưu tiên albums.cover_media_id, nếu NULL thì lấy ảnh mới nhất trong album.
export async function listAlbumCovers(userId, { limit }) {
  const albumsResult = await dbPool.query(
    `SELECT id, name, cover_media_id
     FROM albums
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  const albums = albumsResult.rows;
  if (albums.length === 0) return { items: [] };

  // Ảnh mới nhất trong mỗi album chưa set cover_media_id
  const missingCoverIds = albums
    .filter((a) => a.cover_media_id === null)
    .map((a) => a.id);

  const latestByAlbum = new Map();
  if (missingCoverIds.length > 0) {
    const latestResult = await dbPool.query(
      `SELECT DISTINCT ON (am.album_id)
         am.album_id,
         m.id,
         m.thumbnail_small_object,
         m.thumbnail_object
       FROM album_media am
       JOIN media m ON m.id = am.media_id AND m.deleted_at IS NULL
       WHERE am.album_id = ANY($1::uuid[])
       ORDER BY am.album_id, am.added_at DESC`,
      [missingCoverIds],
    );
    for (const row of latestResult.rows) {
      latestByAlbum.set(String(row.album_id), row);
    }
  }

  const explicitCoverIds = [
    ...new Set(
      albums.map((a) => a.cover_media_id).filter(Boolean),
    ),
  ];
  const explicitById = new Map();
  if (explicitCoverIds.length > 0) {
    const covResult = await dbPool.query(
      `SELECT id, thumbnail_small_object, thumbnail_object
       FROM media
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [explicitCoverIds],
    );
    for (const row of covResult.rows) {
      explicitById.set(String(row.id), row);
    }
  }

  const items = albums.map((a) => {
    const explicit = a.cover_media_id
      ? explicitById.get(String(a.cover_media_id))
      : null;
    const cover = explicit || latestByAlbum.get(String(a.id)) || null;

    let coverUrl = null;
    if (cover) {
      const size = cover.thumbnail_small_object ? "small" : "med";
      coverUrl = `/api/gallery/media/${String(cover.id)}/thumbnail?size=${size}`;
    }

    return { id: String(a.id), name: a.name, coverUrl };
  });

  return { items };
}

export async function restoreMedia(userId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };

  const result = await dbPool.query(
    `UPDATE media
     SET deleted_at = NULL, updated_at = NOW()
     WHERE user_id = $1
       AND id = ANY($2::uuid[])
       AND deleted_at IS NOT NULL
     RETURNING id`,
    [userId, ids],
  );

  return { count: result.rowCount };
}

export async function permanentDeleteMedia(userId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };

  // Lấy danh sách object cần xoá trên MinIO trước khi xoá row — gom batch giống
  // các media dính album/moment: album_media/moments/moment_reactions có FK
  // ON DELETE CASCADE / SET NULL nên xoá row media là đủ, DB tự dọn.
  const picked = await dbPool.query(
    `SELECT id, minio_object, minio_bucket, thumbnail_object, thumbnail_small_object
     FROM media
     WHERE user_id = $1
       AND id = ANY($2::uuid[])
       AND deleted_at IS NOT NULL`,
    [userId, ids],
  );

  if (picked.rows.length === 0) return { count: 0 };

  // Gom object keys để gọi removeObjects hàng loạt trên MinIO
  const objects = new Set();
  for (const row of picked.rows) {
    if (row.minio_object) objects.add(row.minio_object);
    if (row.thumbnail_object) objects.add(row.thumbnail_object);
    if (row.thumbnail_small_object) objects.add(row.thumbnail_small_object);
  }

  const objectList = Array.from(objects);
  const bucket = picked.rows[0].minio_bucket || BUCKET_NAME;
  if (objectList.length > 0) {
    try {
      await minioClient.removeObjects(bucket, objectList);
    } catch (err) {
      console.error("Lỗi xoá object trên MinIO:", err.message);
    }
  }

  const result = await dbPool.query(
    `DELETE FROM media
     WHERE user_id = $1
       AND id = ANY($2::uuid[])
       AND deleted_at IS NOT NULL
     RETURNING id`,
    [userId, ids],
  );

  return { count: result.rowCount };
}
