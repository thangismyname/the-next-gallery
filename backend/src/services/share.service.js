// ==========================================================
// Share Service — Database operations for share sessions
// ==========================================================

import { dbPool } from "../config/db.js";

// ---- Room / session management ----

export async function createShareSession(hostUserId, mediaIds = []) {
  const roomCode = await generateUniqueRoomCode();

  const result = await dbPool.query(
    `INSERT INTO share_sessions (room_code, host_user_id, media_ids, status, expires_at)
     VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '1 hour')
     RETURNING id, room_code, host_user_id, media_ids, status, created_at, expires_at`,
    [roomCode, hostUserId, mediaIds],
  );

  return result.rows[0];
}

export async function getShareSession(sessionId) {
  const result = await dbPool.query(
    `SELECT id, room_code, host_user_id, media_ids, status, transfer_mode, created_at, expires_at
     FROM share_sessions WHERE id = $1`,
    [sessionId],
  );
  return result.rows[0] || null;
}

export async function getShareSessionByCode(roomCode) {
  const result = await dbPool.query(
    `SELECT id, room_code, host_user_id, media_ids, status, transfer_mode, created_at, expires_at
     FROM share_sessions WHERE room_code = $1`,
    [roomCode],
  );
  return result.rows[0] || null;
}

export async function getShareSessionsByUser(userId) {
  const result = await dbPool.query(
    `SELECT id, room_code, host_user_id, media_ids, status, transfer_mode, created_at, expires_at
     FROM share_sessions
     WHERE host_user_id = $1
     ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
  return result.rows;
}

export async function completeShareSession(sessionId) {
  const result = await dbPool.query(
    `UPDATE share_sessions SET status = 'completed'
     WHERE id = $1 RETURNING id`,
    [sessionId],
  );
  return result.rows[0] || null;
}

// ---- Receivers ----

export async function addReceiver(sessionId, userId, username = null) {
  const result = await dbPool.query(
    `INSERT INTO share_session_receivers (session_id, user_id, username, status)
     VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (session_id, user_id) DO NOTHING
     RETURNING id`,
    [sessionId, userId, username],
  );
  return result.rows[0] || null;
}

export async function updateReceiverStatus(sessionId, userId, status) {
  const result = await dbPool.query(
    `UPDATE share_session_receivers
     SET status = $3, completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END
     WHERE session_id = $1 AND user_id = $2
     RETURNING id`,
    [sessionId, userId, status],
  );
  return result.rows[0] || null;
}

export async function getReceivers(sessionId) {
  const result = await dbPool.query(
    `SELECT r.user_id, r.username, r.status, r.created_at, r.completed_at,
            COALESCE(u.name, r.username) AS display_name, u.image AS avatar_url
     FROM share_session_receivers r
     LEFT JOIN "user" u ON u.id = r.user_id
     WHERE r.session_id = $1`,
    [sessionId],
  );
  return result.rows;
}

// ---- Friends ----

export async function getFriends(userId) {
  const result = await dbPool.query(
    `SELECT u.id, u.name, u.email, u.image AS avatar_url
     FROM friendships f
     JOIN "user" u ON u.id = CASE
       WHEN f.requester_id = $1 THEN f.addressee_id
       ELSE f.requester_id
     END
     WHERE (f.requester_id = $1 OR f.addressee_id = $1)
       AND f.status = 'accepted'`,
    [userId],
  );
  return result.rows;
}

// ---- Room code generation with uniqueness check ----

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function generateUniqueRoomCode(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    let code = "";
    for (let j = 0; j < 6; j++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }

    const { rows } = await dbPool.query(
      `SELECT 1 FROM share_sessions WHERE room_code = $1 LIMIT 1`,
      [code],
    );

    if (rows.length === 0) return code;
  }
  throw new Error("Không thể tạo mã phòng duy nhất sau nhiều lần thử");
}