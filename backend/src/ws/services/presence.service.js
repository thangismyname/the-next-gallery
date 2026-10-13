// ==========================================================
// Presence Service — friend online/offline notifications
// ==========================================================
// Leverages the existing in-memory user registry (signaling.service)
// plus DB friendship data to broadcast presence changes:
//   - broadcastOnline(userId): notify all the user's friends that
//     the user just came online.
//   - broadcastOffline(userId): notify all the user's friends that
//     the user went offline.
//   - sendSnapshot(userId): send the connecting user the list of
//     friends who are currently online.
// ==========================================================

import { dbPool } from "../../config/db.js";
import { getPeer, sendToUser } from "./signaling.service.js";

async function getFriendIds(userId) {
  const result = await dbPool.query(
    `SELECT
       CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id
     FROM friendships
     WHERE (requester_id = $1 OR addressee_id = $1)
       AND status = 'accepted'`,
    [userId],
  );
  return result.rows.map((row) => row.friend_id);
}

function publicPeer(userId) {
  const peer = getPeer(userId);
  if (!peer) return null;
  return {
    userId: peer.userId,
    username: peer.username,
    avatarUrl: peer.avatarUrl,
  };
}

// Notify all friends that `userId` just came online.
export async function broadcastOnline(userId) {
  const me = publicPeer(userId);
  if (!me) return;
  const friendIds = await getFriendIds(userId).catch(() => []);
  for (const friendId of friendIds) {
    sendToUser(friendId, "presence:online", { user: me });
  }
}

// Notify all friends that `userId` went offline.
export async function broadcastOffline(userId) {
  const friendIds = await getFriendIds(userId).catch(() => []);
  for (const friendId of friendIds) {
    sendToUser(friendId, "presence:offline", { userId });
  }
}

// Send the connecting user the list of friends currently online.
export async function sendSnapshot(userId) {
  const friendIds = await getFriendIds(userId).catch(() => []);
  const online = [];
  for (const friendId of friendIds) {
    const peer = publicPeer(friendId);
    if (peer) online.push(peer);
  }
  sendToUser(userId, "presence:snapshot", { online });
}