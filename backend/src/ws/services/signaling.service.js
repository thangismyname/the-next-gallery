// ==========================================================
// Signaling Service — In-memory rooms + peer management
// ==========================================================
//
// This service manages:
// - Active rooms (Map<roomId, Room>)
// - Online users (Map<userId, Peer>)
// - Room code → roomId lookup (Map<code, roomId>)
//
// Room structure:
// {
//   id: string,
//   code: string,
//   hostUserId: string,
//   mediaIds: string[],
//   peers: Map<userId, Peer>,
//   createdAt: number,
//   expiresAt: number,
// }
//
// Peer structure:
// {
//   userId: string,
//   username: string,
//   avatarUrl: string | null,
//   sockets: Set<WebSocket>,   // one user may hold several tabs/sockets
//   currentRoomId: string | null,
// }
// ==========================================================

import { buildMessage, generateRoomCode, ROOM_EXPIRY_MS } from "../protocol.js";

// ---- In-memory stores ----
const rooms = new Map();        // roomId → Room
const users = new Map();        // userId → Peer
const codeToRoomId = new Map(); // roomCode → roomId

// ---- Peer (user) management ----

export function registerPeer(userId, username, avatarUrl, ws) {
  const existing = users.get(userId);
  if (existing) {
    existing.username = username;
    existing.avatarUrl = avatarUrl;
    existing.sockets.add(ws);
    return existing;
  }
  const peer = { userId, username, avatarUrl, sockets: new Set([ws]), currentRoomId: null };
  users.set(userId, peer);
  return peer;
}

export function removePeer(userId, ws) {
  const peer = users.get(userId);
  if (!peer) return null;

  peer.sockets.delete(ws);

  // If this user still has other live sockets, keep them registered
  if (peer.sockets.size > 0) return peer;

  // Auto-leave room when the last socket disconnects
  if (peer.currentRoomId) {
    leaveRoom(peer.currentRoomId, userId);
  }
  users.delete(userId);
  return peer;
}

export function getPeer(userId) {
  return users.get(userId) || null;
}

// ---- Send a message to every live socket of a peer ----

function sendToPeer(peer, type, payload) {
  const msg = buildMessage(type, payload);
  for (const socket of peer.sockets) {
    if (socket.readyState === 1) {
      socket.send(msg);
    }
  }
}

// ---- Room management ----

export function createRoom(hostUserId, mediaIds = []) {
  const host = users.get(hostUserId);
  if (!host) return null;

  const roomId = crypto.randomUUID();
  const code = generateRoomCode();
  const now = Date.now();

  const room = {
    id: roomId,
    code,
    hostUserId,
    mediaIds,
    peers: new Map(),
    createdAt: now,
    expiresAt: now + ROOM_EXPIRY_MS,
  };

  // Add host as first peer
  room.peers.set(hostUserId, host);
  host.currentRoomId = roomId;

  rooms.set(roomId, room);
  codeToRoomId.set(code, roomId);

  return room;
}

export function joinRoom(roomCode, userId) {
  const peer = users.get(userId);
  if (!peer) return { error: "USER_NOT_REGISTERED" };

  const roomId = codeToRoomId.get(roomCode);
  if (!roomId) return { error: "ROOM_NOT_FOUND" };

  const room = rooms.get(roomId);
  if (!room) return { error: "ROOM_NOT_FOUND" };

  if (Date.now() > room.expiresAt) {
    destroyRoom(roomId);
    return { error: "ROOM_EXPIRED" };
  }

  // A room host cannot also join their own room (would corrupt room.peers)
  if (room.hostUserId === userId) {
    return { error: "CANNOT_JOIN_OWN_ROOM" };
  }

  // Add peer to room
  room.peers.set(userId, peer);
  peer.currentRoomId = roomId;

  // Notify existing peers about the new user
  const peerInfo = { userId, username: peer.username, avatarUrl: peer.avatarUrl };
  for (const [peerId, existingPeer] of room.peers) {
    if (peerId !== userId) {
      sendToPeer(existingPeer, "room:peer-joined", { peer: peerInfo });
    }
  }

  // Build peer list for the joining user (excluding themselves)
  const existingPeers = [];
  for (const [peerId, p] of room.peers) {
    if (peerId !== userId) {
      existingPeers.push({ userId: peerId, username: p.username, avatarUrl: p.avatarUrl });
    }
  }

  return {
    room: {
      id: roomId,
      code: room.code,
      hostUserId: room.hostUserId,
      mediaIds: room.mediaIds,
      expiresAt: room.expiresAt,
    },
    peers: existingPeers,
  };
}

export function leaveRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const peer = users.get(userId);
  if (peer) {
    peer.currentRoomId = null;
  }

  room.peers.delete(userId);

  // Notify remaining peers
  for (const [, p] of room.peers) {
    sendToPeer(p, "room:peer-left", { peerId: userId });
  }

  // If host left or room is empty, destroy it
  if (userId === room.hostUserId || room.peers.size === 0) {
    destroyRoom(roomId);
  }
}

export function destroyRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  // Kick all remaining peers
  for (const [, peer] of room.peers) {
    peer.currentRoomId = null;
    sendToPeer(peer, "error", { code: "ROOM_DESTROYED", message: "Phòng đã bị đóng" });
  }

  codeToRoomId.delete(room.code);
  rooms.delete(roomId);
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function getRoomByCode(code) {
  const roomId = codeToRoomId.get(code);
  return roomId ? rooms.get(roomId) : null;
}

// ---- Messaging helpers ----

// Delivers to every live socket of the user (covers multi-tab + reconnect)
export function sendToUser(userId, type, payload) {
  const peer = users.get(userId);
  if (!peer) return false;
  sendToPeer(peer, type, payload);
  return true;
}

export function broadcastToRoom(roomId, type, payload, excludeUserId = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  for (const [peerId, peer] of room.peers) {
    if (peerId !== excludeUserId) {
      sendToPeer(peer, type, payload);
    }
  }
}

// ---- Cleanup expired rooms (run periodically) ----

export function cleanupExpiredRooms() {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (now > room.expiresAt) {
      destroyRoom(roomId);
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupExpiredRooms, 5 * 60 * 1000);

// ---- Stats (for debugging) ----

export function getStats() {
  return {
    totalRooms: rooms.size,
    totalOnlineUsers: users.size,
    rooms: Array.from(rooms.values()).map((r) => ({
      id: r.id,
      code: r.code,
      hostUserId: r.hostUserId,
      peerCount: r.peers.size,
      expiresAt: new Date(r.expiresAt).toISOString(),
    })),
  };
}