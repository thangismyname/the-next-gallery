// ==========================================================
// Moments Service — Khoảnh khắc kiểu Locket
// Feed: moments của mình + của bạn bè, sắp theo thời gian chụp
// Template: single (1 ảnh) | duo_square (2 ảnh) | trio_wide (3 ảnh)
// ==========================================================

import { dbPool } from "../config/db.js";

// Số reaction bubble tối đa hiển thị trên 1 moment (FE render chồng từ trái sang).
const MAX_REACTION_BUBBLES = 4;

// ---- Meme templates — memegen.link (không cần auth) ----
const MEMEGEN_BASE = "https://api.memegen.link";
const MEMEGEN_TIMEOUT = 10_000;
const MEME_TEMPLATES_TTL = 6 * 60 * 60 * 1000; // 6h
let memeTemplatesCache = { data: null, at: 0 };

// Số slot mỗi template (0-based index: 0..n-1)
export const COLLAB_SLOT_COUNT = {
  single: 1,
  duo_square: 2,
  trio_wide: 3,
};

// Draft collab chưa đủ slot tự huỷ sau 24h, không hiện ở feed.
export const DRAFT_TTL = "24 hours";

// Cột chung cho toàn bộ truy vấn moment — join media + user info.
// media LEFT JOIN vì template duo/trio có media_id = NULL (ảnh nằm trong moment_collab).
const MOMENT_JOIN = `
    SELECT m.id, m.user_id, m.caption, m.visibility, m.created_at, m.template,
           m.media_id, med.media_type, med.width, med.height, med.duration_seconds,
           u.name AS user_name, u.image AS user_avatar
    FROM moments m
    LEFT JOIN media med ON med.id = m.media_id AND med.deleted_at IS NULL
    JOIN "user" u ON u.id = m.user_id
`;

// Chỉ hiện moment "hoàn chỉnh": single luôn đủ; duo/trio chỉ hiện khi MỌI slot đã filled.
const COMPLETED_FILTER = `
    AND (
      m.template = 'single'
      OR NOT EXISTS (
        SELECT 1 FROM moment_collab mc
        WHERE mc.moment_id = m.id AND mc.filled_at IS NULL
      )
    )
`;

// Xoá draft collab quá hạn (tạo > 24h mà vẫn còn slot trống).
export async function cleanupExpiredDrafts() {
  const result = await dbPool.query(
    `DELETE FROM moments m
     USING moment_collab mc
     WHERE m.template <> 'single'
       AND m.created_at < NOW() - ($1::interval)
       AND mc.moment_id = m.id
       AND mc.filled_at IS NULL
     RETURNING m.id`,
    [DRAFT_TTL],
  );
  return result.rowCount ?? 0;
}

function toMomentItem(row, userId) {
  const template = row.template || "single";
  const slots = row._slots ?? [];
  // Cover = media đầu tiên có ảnh (ưu tiên slot 0). Dùng khi moment là collab.
  const cover = slots.find((s) => s.mediaId) || slots[0] || null;
  const mediaId = row.media_id ? String(row.media_id) : (cover?.mediaId ?? null);
  return {
    id: String(row.id),
    userId: row.user_id,
    userName: row.user_name,
    userAvatarUrl: row.user_avatar || null,
    template,
    slots,
    mediaId,
    mediaType: row.media_type ?? cover?.mediaType ?? "photo",
    caption: row.caption || null,
    visibility: row.visibility,
    thumbnailUrl: mediaId
      ? `/api/gallery/media/${mediaId}/thumbnail?size=small`
      : null,
    url: mediaId ? `/api/gallery/media/${mediaId}/file` : null,
    width: row.width || cover?.width || 800,
    height: row.height || cover?.height || 600,
    durationSeconds: row.duration_seconds ?? cover?.durationSeconds ?? null,
    createdAt: row.created_at ?? null,
    isOwn: row.user_id === userId,
    isParticipant:
      row.user_id !== userId && slots.some((s) => s.userId === userId),
    reactions: row.reactions ?? [],
    recentReactions: row.recent_reactions ?? [],
    myReaction: row.my_reaction ?? null,
    memeCount: 0,
  };
}

// ---- Slots: gắn danh sách người + ảnh từng ô (chỉ template duo/trio) ----

// Gắn moment_collab slots vào rows (mutation: row._slots). Moment single → slots [].
async function attachSlots(rows) {
  const ids = rows
    .filter((row) => row.template && row.template !== "single")
    .map((row) => row.id);
  if (ids.length === 0) {
    for (const row of rows) row._slots = row._slots ?? [];
    return rows;
  }

  const result = await dbPool.query(
    `SELECT mc.moment_id, mc.slot_index, mc.user_id, mc.media_id, mc.filled_at,
            u.name AS user_name, u.image AS user_avatar,
            med.media_type, med.width, med.height, med.duration_seconds
     FROM moment_collab mc
     JOIN "user" u ON u.id = mc.user_id
     LEFT JOIN media med ON med.id = mc.media_id AND med.deleted_at IS NULL
     WHERE mc.moment_id = ANY($1::uuid[])
     ORDER BY mc.moment_id, mc.slot_index`,
    [ids],
  );

  const slotsByMoment = new Map();
  for (const r of result.rows) {
    const list = slotsByMoment.get(r.moment_id) ?? [];
    const mid = r.media_id ? String(r.media_id) : null;
    list.push({
      slotIndex: r.slot_index,
      userId: r.user_id,
      userName: r.user_name,
      userAvatarUrl: r.user_avatar || null,
      mediaId: mid,
      mediaType: r.media_type ?? "photo",
      thumbnailUrl: mid ? `/api/gallery/media/${mid}/thumbnail?size=small` : null,
      url: mid ? `/api/gallery/media/${mid}/file` : null,
      width: r.width ?? 800,
      height: r.height ?? 600,
      durationSeconds: r.duration_seconds ?? null,
      filled: Boolean(r.filled_at),
      filledAt: r.filled_at ?? null,
    });
    slotsByMoment.set(r.moment_id, list);
  }

  for (const row of rows) {
    row._slots = slotsByMoment.get(row.id) ?? [];
  }
  return rows;
}

// ---- Reactions: gắn summary (reactions + myReaction) vào list items ----

// Gắn reaction summary cho 1 danh sách moment. Chạy 3 query nhỏ:
// (1) aggregate count theo emoji, (2) top-N reaction gần nhất kèm avatar user
//     (dùng cho bubble chồng nhau), (3) reaction của chính user hiện tại.
async function attachReactions(items, userId) {
  const ids = items.map((item) => item.id);
  if (ids.length === 0) return items;

  const aggResult = await dbPool.query(
    `SELECT moment_id, reaction_emoji AS emoji, COUNT(*)::int AS count
     FROM moment_reactions
     WHERE moment_id = ANY($1::uuid[]) AND reaction_emoji IS NOT NULL
     GROUP BY moment_id, reaction_emoji`,
    [ids],
  );

  const reactionsByMoment = new Map();
  for (const row of aggResult.rows) {
    const list = reactionsByMoment.get(row.moment_id) ?? [];
    list.push({ emoji: row.emoji, count: row.count });
    reactionsByMoment.set(row.moment_id, list);
  }

  const recentResult = await dbPool.query(
    `WITH recent AS (
       SELECT mr.moment_id, mr.reaction_emoji AS emoji,
              u.id AS user_id, u.name AS user_name, u.image AS user_avatar,
              mr.created_at,
              ROW_NUMBER() OVER (
                PARTITION BY mr.moment_id ORDER BY mr.created_at DESC
              ) AS rn
       FROM moment_reactions mr
       JOIN "user" u ON u.id = mr.user_id
       WHERE mr.moment_id = ANY($1::uuid[]) AND mr.reaction_emoji IS NOT NULL
     )
     SELECT moment_id, emoji,
            user_id, user_name, user_avatar
     FROM recent WHERE rn <= $2
     ORDER BY created_at DESC`,
    [ids, MAX_REACTION_BUBBLES],
  );

  const recentByMoment = new Map();
  for (const row of recentResult.rows) {
    const list = recentByMoment.get(row.moment_id) ?? [];
    list.push({
      emoji: row.emoji ?? null,
      userId: row.user_id,
      userName: row.user_name,
      userAvatarUrl: row.user_avatar || null,
    });
    recentByMoment.set(row.moment_id, list);
  }

  const mineResult = await dbPool.query(
    `SELECT moment_id, reaction_emoji AS emoji
     FROM moment_reactions
     WHERE moment_id = ANY($1::uuid[]) AND user_id = $2
       AND reaction_emoji IS NOT NULL`,
    [ids, userId],
  );
  const myMap = new Map();
  for (const row of mineResult.rows) {
    if (row.emoji) {
      myMap.set(row.moment_id, row.emoji);
    }
  }

  for (const item of items) {
    item.reactions = reactionsByMoment.get(item.id) ?? [];
    item.recentReactions = recentByMoment.get(item.id) ?? [];
    item.myReaction = myMap.get(item.id) ?? null;
  }
  return items;
}

// ---- Memes: gắn tổng số meme vào từng moment (hiện bên thẻ / nút flip) ----

async function attachMemeCounts(items) {
  const ids = items.map((item) => item.id);
  if (ids.length === 0) return items;
  const result = await dbPool.query(
    `SELECT moment_id, COUNT(*)::int AS cnt
     FROM moment_memes
     WHERE moment_id = ANY($1::uuid[])
     GROUP BY moment_id`,
    [ids],
  );
  const map = new Map(result.rows.map((r) => [r.moment_id, r.cnt]));
  for (const item of items) {
    item.memeCount = map.get(item.id) ?? 0;
  }
  return items;
}

// Chuyển 1 row moment_memes (+ user) → object meme trả về cho FE.
function toMemeItem(row, userId) {
  return {
    id: String(row.id),
    momentId: String(row.moment_id),
    userId: row.user_id,
    userName: row.user_name,
    userAvatarUrl: row.user_avatar || null,
    imageUrl: row.image_url,
    templateId: row.template_id ?? null,
    caption: row.caption ?? null,
    createdAt: row.created_at ?? null,
    isOwn: row.user_id === userId,
    reactCount: 0,
    myReact: false,
    reactNames: [],
  };
}

// ---- Feed: moments của mình (mọi visibility) + bạn bè (circle/public) ----

export async function listMomentsFeed(userId, { limit = 40, offset = 0 }) {
  await cleanupExpiredDrafts().catch(() => {});
  const result = await dbPool.query(
    `
    WITH friend_ids AS (
      SELECT CASE
        WHEN requester_id = $1 THEN addressee_id
        ELSE requester_id
      END AS fid
      FROM friendships
      WHERE (requester_id = $1 OR addressee_id = $1)
        AND status = 'accepted'
    )
    ${MOMENT_JOIN}
    WHERE (m.expires_at IS NULL OR m.expires_at > NOW())
      AND (
        m.user_id = $1
        OR (
          m.user_id IN (SELECT fid FROM friend_ids)
          AND m.visibility IN ('circle', 'public')
        )
      )
      ${COMPLETED_FILTER}
    ORDER BY m.created_at DESC
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  await attachSlots(result.rows);
  const items = result.rows.map((row) => toMomentItem(row, userId));
  await attachReactions(items, userId);
  await attachMemeCounts(items);
  return {
    items,
    hasMore: result.rows.length === limit,
    limit,
    offset,
  };
}

// ---- Invitations: moment collab tôi còn phải điền ảnh / đang chờ bạn ----

// Lấy draft collab (còn slot trống, chưa quá 24h) mà user liên quan:
// (a) moment tôi được mời điền slot còn trống, (b) moment tôi tạo đang chờ bạn.
export async function listMomentInvitations(userId) {
  await cleanupExpiredDrafts().catch(() => {});
  const result = await dbPool.query(
    `
    ${MOMENT_JOIN}
    WHERE m.template <> 'single'
      AND m.created_at > NOW() - ($2::interval)
      AND EXISTS (
        -- moment này vẫn còn slot trống (draft)
        SELECT 1 FROM moment_collab mc2
        WHERE mc2.moment_id = m.id AND mc2.filled_at IS NULL
      )
      AND (
        m.user_id = $1
        OR EXISTS (
          SELECT 1 FROM moment_collab mc
          WHERE mc.moment_id = m.id AND mc.user_id = $1 AND mc.filled_at IS NULL
        )
      )
    ORDER BY m.created_at DESC`,
    [userId, DRAFT_TTL],
  );

  await attachSlots(result.rows);
  let items = result.rows.map((row) => toMomentItem(row, userId));
  items = await attachReactions(items, userId);
  items = await attachMemeCounts(items);

  // Gắn thông tin "tôi đang giữ slot trống nào / tôi là creator chờ ai"
  for (const item of items) {
    const mySlots = item.slots.filter((s) => s.userId === userId && !s.filled);
    item.myPendingSlots = mySlots.map((s) => s.slotIndex);
    item.myPendingSlot = item.myPendingSlots[0] ?? null;
    item.pendingCount = item.slots.filter((s) => !s.filled).length;
  }
  return items;
}

// ---- Validate + chuẩn hoá payload moment (single / self-fill / collab) ----
// Dùng chung cho createMoment (tạo mới) và updateDraftMoment (chỉnh sửa draft).
async function normalizeDraftPayload(userId, payload) {
  const {
    template = "single",
    mediaId = null,
    mediaIds = [],
    collaboratorIds = [],
    caption,
    visibility = "circle",
  } = payload || {};

  const slotCount = COLLAB_SLOT_COUNT[template] ?? 1;
  const isCollab = template !== "single";
  let creatorMediaIds = [];

  if (!isCollab) {
    if (!mediaId) {
      throw Object.assign(new Error("Thiếu ảnh cho moment"), { status: 400 });
    }
    creatorMediaIds = [mediaId];
  } else if (collaboratorIds.length === 0) {
    // Self-fill collage: chọn đủ ảnh bằng số slot
    if (mediaIds.length !== slotCount) {
      throw Object.assign(
        new Error(`Template ${template} cần ${slotCount} ảnh (self-fill)`),
        { status: 400 },
      );
    }
    creatorMediaIds = mediaIds;
  } else {
    // Collaborative: creator đăng 1..slotCount-1 ảnh từ các slot đầu,
    // bạn bè điền phần slot còn lại (mỗi bạn ít nhất 1 slot).
    // Số bạn linh hoạt — nếu bạn được chọn ít hơn số slot trống thì 1 bạn sẽ
    // điền nhiều ảnh (vd 3 ảnh + 1 bạn: bạn đăng 1-2 ảnh, người kia điền 2-1).
    creatorMediaIds = mediaIds.length > 0 ? mediaIds : mediaId ? [mediaId] : [];
    if (creatorMediaIds.length < 1 || creatorMediaIds.length > slotCount - 1) {
      throw Object.assign(
        new Error(`Bạn cần đăng từ 1 đến ${slotCount - 1} ảnh của mình`),
        { status: 400 },
      );
    }
    if (collaboratorIds.length < 1 || collaboratorIds.length > slotCount - 1) {
      throw Object.assign(
        new Error(`Template ${template} cần từ 1 đến ${slotCount - 1} bạn bè`),
        { status: 400 },
      );
    }
    if (creatorMediaIds.length + collaboratorIds.length > slotCount) {
      throw Object.assign(
        new Error(
          `Tổng ${creatorMediaIds.length} ảnh của bạn + ${collaboratorIds.length} người được mời vượt ${slotCount} slot`,
        ),
        { status: 400 },
      );
    }
    if (collaboratorIds.includes(userId)) {
      throw Object.assign(new Error("Không thể mời chính mình"), {
        status: 400,
      });
    }
    if (new Set(collaboratorIds).size !== collaboratorIds.length) {
      throw Object.assign(new Error("Bạn bè trùng lặp"), { status: 400 });
    }
  }

  // --- Kiểm tra quyền sở hữu media ---
  const ownerMediaIds = creatorMediaIds;

  if (ownerMediaIds.length > 0) {
    const owned = await dbPool.query(
      `SELECT id FROM media
       WHERE id = ANY($1::uuid[]) AND user_id = $2 AND deleted_at IS NULL`,
      [ownerMediaIds, userId],
    );
    if (owned.rows.length !== ownerMediaIds.length) {
      throw Object.assign(
        new Error("Không tìm thấy ảnh/video để đăng moment"),
        { status: 404 },
      );
    }
  }

  // --- Kiểm tra bạn bè (chỉ khi collaborative) ---
  if (collaboratorIds.length > 0) {
    const friends = await dbPool.query(
      `SELECT addressee_id FROM friendships
       WHERE status = 'accepted'
         AND (
           (requester_id = $1 AND addressee_id = ANY($2::text[]))
           OR (requester_id = ANY($2::text[]) AND addressee_id = $1)
         )`,
      [userId, collaboratorIds],
    );
    if (friends.rows.length !== collaboratorIds.length) {
      throw Object.assign(
        new Error("Chỉ có thể mời bạn bè tham gia moment"),
        { status: 400 },
      );
    }
  }

  return {
    template,
    mediaId,
    mediaIds,
    creatorMediaIds,
    collaboratorIds,
    caption,
    visibility,
    slotCount,
    isCollab,
    text: typeof caption === "string" ? caption.trim() : "",
  };
}

// Ghi các row moment_collab cho 1 moment (self-fill hoặc collab).
// Moment single không có collab — gọi với isCollab=false thì bỏ qua.
async function insertMomentSlots(client, momentId, userId, norm) {
  if (!norm.isCollab) return;

  // Creator chiếm các slot ĐẦU Tiên với ảnh của họ (1 ảnh trong self/2-ảnh tuỳ chọn),
  // phần slot còn lại chia cho bạn bè (mỗi người ít nhất 1 slot).
  const creatorMediaIds = norm.creatorMediaIds ?? [];
  for (let i = 0; i < creatorMediaIds.length; i++) {
    await client.query(
      `INSERT INTO moment_collab (moment_id, slot_index, user_id, media_id, filled_at)
       VALUES ($1, $2, $3, $4, now())`,
      [momentId, i, userId, creatorMediaIds[i]],
    );
  }

  if (norm.collaboratorIds.length === 0) return;

  const friendSlots = norm.slotCount - creatorMediaIds.length;
  const n = norm.collaboratorIds.length;
  const base = Math.floor(friendSlots / n);
  const rem = friendSlots % n;
  let slotIdx = creatorMediaIds.length;
  for (let i = 0; i < n; i++) {
    const slots = base + (i < rem ? 1 : 0);
    for (let k = 0; k < slots; k++) {
      await client.query(
        `INSERT INTO moment_collab (moment_id, slot_index, user_id)
         VALUES ($1, $2, $3)`,
        [momentId, slotIdx, norm.collaboratorIds[i]],
      );
      slotIdx += 1;
    }
  }
}

// Nạp 1 moment (kèm slots + item response) theo id.
async function getMomentItem(momentId, userId) {
  const rowResult = await dbPool.query(`${MOMENT_JOIN} WHERE m.id = $1`, [
    momentId,
  ]);
  if (rowResult.rows.length === 0) return null;
  await attachSlots(rowResult.rows);
  return toMomentItem(rowResult.rows[0], userId);
}

// ---- Tạo moment từ 1 ảnh/video đã có trong media của user ----
// Hỗ trợ template: single (mediaId), duo/trio self-fill (mediaIds đủ slot),
// duo/trio collab (mediaIds = 1..slotCount-1 ảnh của creator chiếm slot đầu
// + collaboratorIds điền phần slot còn lại).
export async function createMoment(userId, payload) {
  const norm = await normalizeDraftPayload(userId, payload);

  const client = await dbPool.connect();
  let momentId;
  // duo/trio: moments.media_id luôn NULL (CHECK chk_template_media) — ảnh nằm hết trong moment_collab
  const momentMediaId = norm.isCollab ? null : norm.mediaId;
  try {
    await client.query("BEGIN");
    const insertResult = await client.query(
      `INSERT INTO moments (user_id, media_id, template, caption, visibility)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [userId, momentMediaId, norm.template, norm.text || null, norm.visibility],
    );
    momentId = insertResult.rows[0].id;

    await insertMomentSlots(client, momentId, userId, norm);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getMomentItem(momentId, userId);
}

// ---- Chỉnh sửa draft moment collab (chưa đủ slot) do chính mình tạo ----
// Cho phép "quay lại edit" trước khi moment được hoàn thiện (vào feed):
// đổi template/ảnh của mình/caption/visibility/bạn bè → rebuild lại slots.
// Trả về { moment, previousCollaboratorIds } để route biết ai là bạn mới cần mời lại.
export async function updateDraftMoment(userId, momentId, payload) {
  const draft = await dbPool.query(
    `SELECT m.id, m.template
     FROM moments m
     WHERE m.id = $1 AND m.user_id = $2`,
    [momentId, userId],
  );
  if (draft.rows.length === 0) {
    throw Object.assign(new Error("Không tìm thấy moment"), { status: 404 });
  }

  // Chỉ cho chỉnh sửa khi vẫn còn draft (more 1 slot trống) — moment đủ ảnh rồi thì không đổi được.
  const incomplete = await dbPool.query(
    `SELECT 1 FROM moment_collab mc
     WHERE mc.moment_id = $1 AND mc.filled_at IS NULL LIMIT 1`,
    [momentId],
  );
  if (draft.rows[0].template === "single" || incomplete.rowCount === 0) {
    throw Object.assign(new Error("Moment đã hoàn chỉnh, không thể chỉnh sửa"), {
      status: 409,
    });
  }

  const norm = await normalizeDraftPayload(userId, payload);
  if (!norm.isCollab || norm.collaboratorIds.length === 0) {
    throw Object.assign(
      new Error("Draft collab phải giữ chế độ cùng bạn bè điền ảnh"),
      { status: 400 },
    );
  }

  // Bạn bè hiện tại của draft (để biết ai được thêm mới khi edit)
  const previous = await dbPool.query(
    `SELECT user_id FROM moment_collab
     WHERE moment_id = $1 AND user_id <> $2 AND user_id IS NOT NULL
     GROUP BY user_id`,
    [momentId, userId],
  );
  const previousCollaboratorIds = previous.rows.map((r) => r.user_id);

  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM moment_collab WHERE moment_id = $1`, [
      momentId,
    ]);
    await client.query(
      `UPDATE moments
       SET media_id = NULL, template = $2, caption = $3, visibility = $4
       WHERE id = $1`,
      [momentId, norm.template, norm.text || null, norm.visibility],
    );
    await insertMomentSlots(client, momentId, userId, norm);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const moment = await getMomentItem(momentId, userId);
  return { moment, previousCollaboratorIds };
}

// ---- Điền ảnh vào các slot trống của chính mình (collab draft) ----

// user gửi mediaIds (1+ ảnh) để lấp tuần tự những slot trống của họ.
// 1 người giữ nhiều slot (vd 3 ảnh chỉ 1 bạn) thì gửi nhiều ảnh một lúc.
// Trả về { filled, complete, moment } — complete = moment giờ đủ slot (vào feed).
export async function fillMomentSlots(userId, momentId, mediaIds) {
  // Các slot trống của user hiện tại trong moment (sắp theo thứ tự ô)
  const slotResult = await dbPool.query(
    `SELECT mc.slot_index, m.created_at
     FROM moment_collab mc
     JOIN moments m ON m.id = mc.moment_id
     WHERE mc.moment_id = $1 AND mc.user_id = $2 AND mc.filled_at IS NULL
     ORDER BY mc.slot_index`,
    [momentId, userId],
  );
  if (slotResult.rows.length === 0) {
    throw Object.assign(
      new Error("Không tìm thấy slot của bạn để điền ảnh"),
      { status: 404 },
    );
  }

  const firstSlot = slotResult.rows[0];
  if (firstSlot.created_at < new Date(Date.now() - 24 * 3600 * 1000)) {
    throw Object.assign(new Error("Moment này đã hết hạn"), { status: 410 });
  }

  if (mediaIds.length === 0 || mediaIds.length > slotResult.rows.length) {
    throw Object.assign(
      new Error(`Bạn chỉ có ${slotResult.rows.length} slot trống để điền ảnh`),
      { status: 400 },
    );
  }
  if (new Set(mediaIds).size !== mediaIds.length) {
    throw Object.assign(new Error("Ảnh trùng lặp"), { status: 400 });
  }

  // Kiểm tra media đều thuộc về user
  const mediaResult = await dbPool.query(
    `SELECT id FROM media WHERE id = ANY($1::uuid[]) AND user_id = $2 AND deleted_at IS NULL`,
    [mediaIds, userId],
  );
  if (mediaResult.rows.length !== mediaIds.length) {
    throw Object.assign(new Error("Không tìm thấy ảnh/video để điền slot"), {
      status: 404,
    });
  }

  // Lấp tuần tự các slot trống (ô đầu tiên ↔ ảnh đầu tiên)
  const targetSlots = slotResult.rows.slice(0, mediaIds.length);
  for (let i = 0; i < targetSlots.length; i++) {
    await dbPool.query(
      `UPDATE moment_collab
       SET media_id = $1, filled_at = now()
       WHERE moment_id = $2 AND slot_index = $3 AND user_id = $4`,
      [mediaIds[i], momentId, targetSlots[i].slot_index, userId],
    );
  }

  // Kiểm tra đã đủ slot chưa
  const remaining = await dbPool.query(
    `SELECT COUNT(*)::int AS cnt FROM moment_collab
     WHERE moment_id = $1 AND filled_at IS NULL`,
    [momentId],
  );
  const complete = remaining.rows[0].cnt === 0;

  const rowResult = await dbPool.query(`${MOMENT_JOIN} WHERE m.id = $1`, [momentId]);
  await attachSlots(rowResult.rows);
  const moment = toMomentItem(rowResult.rows[0], userId);
  return { filled: targetSlots.length, complete, moment };
}

// ---- Xóa moment của chính mình ----

export async function deleteMoment(userId, momentId) {
  const result = await dbPool.query(
    `DELETE FROM moments WHERE id = $1 AND user_id = $2 RETURNING id`,
    [momentId, userId],
  );
  return result.rowCount > 0;
}

// ---- Rời moment collab (gỡ ảnh của mình khỏi slot) ----
// Dành cho người được mời (không phải creator): gỡ toàn bộ ảnh của mình,
// moment quay về trạng thái chưa đủ slot (draft) — creator có thể mời/điều chỉnh lại.

export async function leaveMoment(userId, momentId) {
  const momentResult = await dbPool.query(
    `SELECT m.id, m.user_id, m.template
     FROM moments m WHERE m.id = $1`,
    [momentId],
  );
  if (momentResult.rows.length === 0) {
    throw Object.assign(new Error("Không tìm thấy moment"), { status: 404 });
  }
  const moment = momentResult.rows[0];
  if (moment.template === "single") {
    throw Object.assign(new Error("Không thể rời moment chỉ có 1 ảnh"), {
      status: 400,
    });
  }
  if (moment.user_id === userId) {
    throw Object.assign(
      new Error("Bạn là người tạo moment — hãy xóa nó nếu không muốn"),
      { status: 400 },
    );
  }

  const slotResult = await dbPool.query(
    `SELECT slot_index FROM moment_collab
     WHERE moment_id = $1 AND user_id = $2`,
    [momentId, userId],
  );
  if (slotResult.rows.length === 0) {
    throw Object.assign(new Error("Bạn không tham gia moment này"), {
      status: 404,
    });
  }

  await dbPool.query(
    `UPDATE moment_collab
     SET media_id = NULL, filled_at = NULL
     WHERE moment_id = $1 AND user_id = $2`,
    [momentId, userId],
  );

  return getMomentItem(momentId, userId);
}

// ---- Reactions: react / bỏ react ----

// Kiểm tra user hiện tại có QUYỀN xem moment này không (mình hoặc
// bạn bè + visibility circle/public, chưa hết hạn, và moment đã hoàn chỉnh).
async function canViewMoment(userId, momentId) {
  const result = await dbPool.query(
    `
    WITH friend_ids AS (
      SELECT CASE
        WHEN requester_id = $1 THEN addressee_id
        ELSE requester_id
      END AS fid
      FROM friendships
      WHERE (requester_id = $1 OR addressee_id = $1)
        AND status = 'accepted'
    )
    SELECT 1 FROM moments m
    WHERE m.id = $2
      AND (m.expires_at IS NULL OR m.expires_at > NOW())
      AND (
        m.user_id = $1
        OR (m.user_id IN (SELECT fid FROM friend_ids) AND m.visibility IN ('circle', 'public'))
      )
      AND (
        m.template = 'single'
        OR NOT EXISTS (
          SELECT 1 FROM moment_collab mc
          WHERE mc.moment_id = m.id AND mc.filled_at IS NULL
        )
      )`,
    [userId, momentId],
  );
  return result.rowCount > 0;
}

// React 1 lần / moment (UNIQUE moment_id+user_id). Nếu đã có → cập nhật lại.
export async function createReaction(
  userId,
  momentId,
  { emoji = null },
) {
  if (!emoji) {
    throw Object.assign(new Error("Phải có emoji"), {
      status: 400,
    });
  }

  if (!(await canViewMoment(userId, momentId))) {
    throw Object.assign(new Error("Không tìm thấy moment"), { status: 404 });
  }

  const cleanEmoji = String(emoji).slice(0, 10);
  const result = await dbPool.query(
    `INSERT INTO moment_reactions (moment_id, user_id, reaction_emoji)
     VALUES ($1, $2, $3)
     ON CONFLICT (moment_id, user_id)
     DO UPDATE SET
       reaction_emoji = EXCLUDED.reaction_emoji,
       created_at = now()
     RETURNING reaction_emoji`,
    [momentId, userId, cleanEmoji],
  );

  const row = result.rows[0];
  return {
    reacted: true,
    emoji: row.reaction_emoji ?? null,
  };
}

export async function deleteReaction(userId, momentId) {
  const result = await dbPool.query(
    `DELETE FROM moment_reactions WHERE moment_id = $1 AND user_id = $2 RETURNING id`,
    [momentId, userId],
  );
  return result.rowCount > 0;
}

// ---- Memes: template nguồn + list + create + delete ----

// Danh sách template meme từ memegen.link (cache 6h, fallback dữ liệu cũ khi lỗi mạng).
export async function fetchMemeTemplates() {
  if (
    memeTemplatesCache.data &&
    Date.now() - memeTemplatesCache.at < MEME_TEMPLATES_TTL
  ) {
    return memeTemplatesCache.data;
  }

  let rows = [];
  try {
    const res = await fetch(`${MEMEGEN_BASE}/templates`, {
      signal: AbortSignal.timeout(MEMEGEN_TIMEOUT),
    });
    if (!res.ok) throw new Error("HTTP error");
    rows = await res.json();
  } catch (error) {
    if (memeTemplatesCache.data) return memeTemplatesCache.data; // stale fallback
    throw Object.assign(
      new Error("Không tải được template meme từ nguồn ngoài"),
      { status: 502 },
    );
  }

  const items = (Array.isArray(rows) ? rows : []).map((r) => ({
    id: r.id,
    name: r.name,
    lines: r.lines ?? 2,
    blankUrl: r.blank ?? `${MEMEGEN_BASE}/images/${r.id}.jpg`,
  }));
  memeTemplatesCache = { data: items, at: Date.now() };
  return items;
}

// Danh sách meme của 1 moment (mới → cũ, phân trang cho scroll vô hạn).
export async function listMomentMemes(userId, momentId, { limit = 20, offset = 0 }) {
  if (!(await canViewMoment(userId, momentId))) {
    return { items: [], hasMore: false, limit, offset };
  }

  const result = await dbPool.query(
    `SELECT mm.id, mm.moment_id, mm.user_id, mm.image_url, mm.template_id,
            mm.caption, mm.created_at,
            u.name AS user_name, u.image AS user_avatar
     FROM moment_memes mm
     JOIN "user" u ON u.id = mm.user_id
     WHERE mm.moment_id = $1
     ORDER BY mm.created_at DESC
     LIMIT $2 OFFSET $3`,
    [momentId, limit, offset],
  );

  const items = result.rows.map((row) => toMemeItem(row, userId));
  await attachMemeReactions(items, userId);
  return { items, hasMore: result.rows.length === limit, limit, offset };
}

// Gắn thông tin tim (❤️) cho danh sách meme của 1 page:
// reactCount = tổng số tim, myReact = user hiện tại đã tim chưa,
// reactNames = list tên người tim (tối đa 3, để tooltip "ai đã tim").
async function attachMemeReactions(items, userId) {
  if (items.length === 0) return;
  const ids = items.map((item) => item.id);

  const countResult = await dbPool.query(
    `SELECT meme_id, COUNT(*)::int AS cnt
     FROM meme_reactions
     WHERE meme_id = ANY($1::uuid[])
     GROUP BY meme_id`,
    [ids],
  );
  const countMap = new Map(countResult.rows.map((r) => [String(r.meme_id), r.cnt]));

  const nameResult = await dbPool.query(
    `SELECT mr.meme_id, u.name
     FROM meme_reactions mr
     JOIN "user" u ON u.id = mr.user_id
     WHERE mr.meme_id = ANY($1::uuid[])
       AND mr.user_id <> $2
     ORDER BY mr.created_at DESC`,
    [ids, userId],
  );
  const namesMap = new Map();
  for (const r of nameResult.rows) {
    const key = String(r.meme_id);
    if (!namesMap.has(key)) namesMap.set(key, []);
    if (namesMap.get(key).length < 3) namesMap.get(key).push(r.name);
  }

  for (const item of items) {
    item.reactCount = countMap.get(item.id) ?? 0;
  }

  // myReact chính xác: user hiện tại đã tim meme đó chưa.
  const myResult = await dbPool.query(
    `SELECT meme_id FROM meme_reactions WHERE user_id = $1 AND meme_id = ANY($2::uuid[])`,
    [userId, ids],
  );
  const mySet = new Set(myResult.rows.map((r) => String(r.meme_id)));
  for (const item of items) {
    item.myReact = mySet.has(item.id);
    item.reactNames = namesMap.get(item.id) ?? [];
  }
}

// Bấm tim (❤️) 1 meme — toggle: đã tim thì bỏ tim. Trả trạng thái mới.
export async function toggleMemeReaction(userId, memeId) {
  const exists = await dbPool.query(
    `SELECT 1 FROM moment_memes WHERE id = $1`,
    [memeId],
  );
  if (exists.rowCount === 0) {
    throw Object.assign(new Error("Không tìm thấy meme"), { status: 404 });
  }

  const inserted = await dbPool.query(
    `INSERT INTO meme_reactions (meme_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (meme_id, user_id) DO NOTHING`,
    [memeId, userId],
  );
  const liked = inserted.rowCount > 0;
  if (!liked) {
    await dbPool.query(
      `DELETE FROM meme_reactions WHERE meme_id = $1 AND user_id = $2`,
      [memeId, userId],
    );
  }

  const countResult = await dbPool.query(
    `SELECT COUNT(*)::int AS cnt FROM meme_reactions WHERE meme_id = $1`,
    [memeId],
  );
  return { myReact: liked, reactCount: countResult.rows[0].cnt };
}

// Tạo meme: gọi memegen.link render ảnh từ template + dòng chữ, rồi lưu URL.
export async function createMomentMeme(userId, momentId, { templateId, lines, caption }) {
  if (!(await canViewMoment(userId, momentId))) {
    throw Object.assign(new Error("Không tìm thấy moment"), { status: 404 });
  }

  const genParams = new URLSearchParams();
  genParams.set("template_id", templateId);
  for (const line of lines) {
    const text = String(line).trim();
    if (text) genParams.append("text[]", text);
  }

  let imageUrl;
  try {
    const res = await fetch(`${MEMEGEN_BASE}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: genParams.toString(),
      signal: AbortSignal.timeout(MEMEGEN_TIMEOUT),
    });
    if (!res.ok) {
      throw Object.assign(new Error("Template meme không hợp lệ"), {
        status: 502,
      });
    }
    const data = await res.json();
    imageUrl = data.url;
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error("Không thể kết nối nguồn meme"), {
      status: 502,
    });
  }

  if (
    typeof imageUrl !== "string" ||
    !imageUrl.startsWith(`${MEMEGEN_BASE}/images/`)
  ) {
    throw Object.assign(new Error("Nguồn meme trả về URL không hợp lệ"), {
      status: 502,
    });
  }

  const cleanCaption =
    typeof caption === "string" && caption.trim()
      ? caption.trim().slice(0, 280)
      : null;

  const insertResult = await dbPool.query(
    `INSERT INTO moment_memes (moment_id, user_id, image_url, template_id, caption)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [momentId, userId, imageUrl, String(templateId).slice(0, 64), cleanCaption],
  );

  const itemResult = await dbPool.query(
    `SELECT mm.id, mm.moment_id, mm.user_id, mm.image_url, mm.template_id,
            mm.caption, mm.created_at,
            u.name AS user_name, u.image AS user_avatar
     FROM moment_memes mm
     JOIN "user" u ON u.id = mm.user_id
     WHERE mm.id = $1`,
    [insertResult.rows[0].id],
  );
  return toMemeItem(itemResult.rows[0], userId);
}

// Xóa meme của chính mình.
export async function deleteMomentMeme(userId, memeId) {
  const result = await dbPool.query(
    `DELETE FROM moment_memes WHERE id = $1 AND user_id = $2 RETURNING id`,
    [memeId, userId],
  );
  return result.rowCount > 0;
}

// Danh sách user liên quan trực tiếp tới moment (owner + người trong collab)
// — dùng để WS broadcast khi có meme mới/xóa.
export async function getMomentParticipantIds(momentId) {
  const result = await dbPool.query(
    `SELECT user_id FROM moments WHERE id = $1
     UNION
     SELECT user_id FROM moment_collab
     WHERE moment_id = $1 AND user_id IS NOT NULL`,
    [momentId],
  );
  return result.rows.map((r) => r.user_id);
}