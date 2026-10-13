// Embedding service — lưu/backfill CLIP embeddings và semantic search qua pgvector.
//
// Luồng:
//  - Upload ảnh → media.service gọi `embedMediaInBackground` (fire-and-forget).
//  - Ảnh cũ chưa có embedding → `backfillEmbeddings` xử lý theo lô.
//  - Search → `semanticSearch`: embed câu truy vấn rồi so cosine trong DB.
import { dbPool } from "../config/db.js";
import { minioClient, BUCKET_NAME } from "../config/minio.js";
import { embedImage, embedText } from "./ai.service.js";
import sharp from "sharp";

// Cạnh dài tối đa khi gửi ảnh cho CLIP — đủ ngữ nghĩa, payload nhỏ (ảnh gốc có
// thể >10MB, vượt giới hạn nhận file của ai-service).
const EMBED_MAX_EDGE = 512;

// Vector pgvector nhận dạng literal text '[v1,v2,...]' khi cast ::vector.
function toVectorLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}

// Ngưỡng cosine tối thiểu để coi là "khớp ngữ nghĩa". CLIP ViT-B-32:
// nội dung liên quan thường 0.25–0.35, ngẫu nhiên ~0.15–0.2. Đặt 0 để tắt ngưỡng.
const MIN_SIM = Number.isFinite(Number(process.env.AI_CLIP_MIN_SIM))
  ? Number(process.env.AI_CLIP_MIN_SIM)
  : 0.22;

// CLIP paper hay bọc nhãn trong template "a photo of a {x}" — cải thiện retrieval
// đáng kể so với từ khoá trần. Chỉ áp dụng cho query ngắn (≤3 từ, không dấu câu
// /kết thúc) để không làm hỏng câu mô tả dài.
const CLIP_QUERY_TEMPLATE = "a photo of a {}";

function applyQueryTemplate(query) {
  const trimmed = query.trim().replace(/[.!?,;:]+$/g, "").trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return query;
  return CLIP_QUERY_TEMPLATE.replace("{}", trimmed.length > 0 ? trimmed : query);
}

// Chuẩn hoá ảnh (bất kể nguồn/định dạng) về WebP cạnh ≤512px trước khi embed.
async function toEmbedBuffer(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(EMBED_MAX_EDGE, EMBED_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function saveEmbedding(mediaId, userId, model, embedding) {
  await dbPool.query(
    `INSERT INTO media_embeddings (media_id, user_id, model, embedding, created_at, updated_at)
     VALUES ($1, $2, $3, $4::vector, NOW(), NOW())
     ON CONFLICT (media_id) DO UPDATE
       SET model = EXCLUDED.model,
           embedding = EXCLUDED.embedding,
           updated_at = NOW()`,
    [mediaId, userId, model, toVectorLiteral(embedding)],
  );
}

/**
 * Tạo embedding từ buffer ảnh đã có sẵn (dùng cho upload) và lưu vào DB.
 * Trả về kết quả ai-service hoặc null nếu pipeline không khả dụng.
 */
export async function embedMediaBuffer({ mediaId, userId, buffer }) {
  const prepared = await toEmbedBuffer(buffer);
  const result = await embedImage(prepared, "image/webp", `${mediaId}`);
  if (!result?.embedding?.length) return null;
  await saveEmbedding(mediaId, userId, result.model, result.embedding);
  return result;
}

/**
 * Fire-and-forget: chạy nền, không chặn response upload. Mọi lỗi chỉ log.
 */
export function embedMediaInBackground(args) {
  embedMediaBuffer(args).catch((err) => {
    console.warn(`⚠️  Embed media ${args.mediaId} lỗi: ${err.message}`);
  });
}

/**
 * Lấy object gốc từ MinIO rồi tạo embedding — dùng cho backfill ảnh cũ.
 */
export async function embedMediaById(mediaId, userId) {
  const result = await dbPool.query(
    `SELECT minio_object, minio_bucket, thumbnail_object, media_type
     FROM media
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [mediaId, userId],
  );
  if (result.rows.length === 0) return null;

  const media = result.rows[0];
  if (media.media_type !== "photo") return null;

  const bucket = media.minio_bucket || BUCKET_NAME;
  // Ưu tiên thumbnail (nhỏ, nhanh); fallback file gốc nếu ảnh cũ chưa có thumbnail.
  const objectKey = media.thumbnail_object || media.minio_object;

  const stream = await minioClient.getObject(bucket, objectKey);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  return embedMediaBuffer({ mediaId, userId, buffer });
}

/**
 * Tìm và embed các ảnh của user chưa có embedding (theo lô). Trả thống kê.
 */
export async function backfillEmbeddings(userId, { limit = 50 } = {}) {
  const result = await dbPool.query(
    `SELECT m.id
     FROM media m
     LEFT JOIN media_embeddings e ON e.media_id = m.id
     WHERE m.user_id = $1
       AND m.media_type = 'photo'
       AND m.deleted_at IS NULL
       AND e.media_id IS NULL
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  let embedded = 0;
  let failed = 0;
  for (const row of result.rows) {
    try {
      const done = await embedMediaById(String(row.id), userId);
      if (done) embedded += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.warn(`⚠️  Backfill embed ${row.id} lỗi: ${err.message}`);
    }
  }

  const pending = await dbPool.query(
    `SELECT COUNT(*)::int AS count
     FROM media m
     LEFT JOIN media_embeddings e ON e.media_id = m.id
     WHERE m.user_id = $1
       AND m.media_type = 'photo'
       AND m.deleted_at IS NULL
       AND e.media_id IS NULL`,
    [userId],
  );

  return { embedded, failed, remaining: pending.rows[0]?.count ?? 0 };
}

/** Thống kê số ảnh / số ảnh đã có embedding của user. */
export async function getEmbeddingStats(userId) {
  const result = await dbPool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(e.media_id)::int AS embedded
     FROM media m
     LEFT JOIN media_embeddings e ON e.media_id = m.id
     WHERE m.user_id = $1
       AND m.media_type = 'photo'
       AND m.deleted_at IS NULL`,
    [userId],
  );
  const row = result.rows[0] ?? { total: 0, embedded: 0 };
  return {
    total: row.total,
    embedded: row.embedded,
    pending: Math.max(0, row.total - row.embedded),
  };
}

/**
 * Semantic search: embed câu truy vấn rồi tìm ảnh gần nhất theo cosine.
 *
 * - Query ngắn được bọc template CLIP "a photo of a {query}".
 * - Chỉ trả ảnh có similarity ≥ ngưỡng (`AI_CLIP_MIN_SIM`, mặc định 0.22).
 *
 * @returns {Promise<{ hits: { id: string, score: number }[], hadEmbeddings: boolean }>}
 *   `hits` sắp theo độ tương đồng giảm dần; `hadEmbeddings` = user có ít nhất
 *   1 embedding trong DB (dùng để phân biệt "đã có embedding nhưng dưới ngưỡng"
 *   với "chưa embedding nào" → có nên fallback tìm tên file hay không).
 */
export async function semanticSearch(userId, query, limit = 20) {
  const queryEmbedding = await embedText(applyQueryTemplate(query));
  if (!queryEmbedding?.embedding?.length) {
    return { hits: [], hadEmbeddings: false };
  }

  const hasEmbResult = await dbPool.query(
    `SELECT 1 FROM media_embeddings WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const hadEmbeddings = (hasEmbResult?.rowCount ?? 0) > 0;

  const result = await dbPool.query(
    `SELECT m.id, 1 - (e.embedding <=> $2::vector) AS score
     FROM media_embeddings e
     JOIN media m ON m.id = e.media_id
     WHERE e.user_id = $1
       AND m.deleted_at IS NULL
       ${MIN_SIM > 0 ? "AND 1 - (e.embedding <=> $2::vector) >= $3" : ""}
     ORDER BY e.embedding <=> $2::vector
     LIMIT $${MIN_SIM > 0 ? 4 : 3}`,
    MIN_SIM > 0
      ? [userId, toVectorLiteral(queryEmbedding.embedding), MIN_SIM, limit]
      : [userId, toVectorLiteral(queryEmbedding.embedding), limit],
  );

  return {
    hits: result.rows.map((row) => ({
      id: String(row.id),
      score: Number(row.score),
    })),
    hadEmbeddings,
  };
}
