// ==========================================================
// WebSocket Signaling Protocol — Message type constants
// ==========================================================

// Client → Server
export const MSG = {
  // Auth
  AUTH: "auth",

  // Room management
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",

  // WebRTC signaling relay
  SIGNAL_OFFER: "signal:offer",
  SIGNAL_ANSWER: "signal:answer",
  SIGNAL_ICE: "signal:ice-candidate",

  // File transfer
  TRANSFER_METADATA: "transfer:metadata",
  TRANSFER_ACCEPT: "transfer:accept",
  TRANSFER_REJECT: "transfer:reject",
  TRANSFER_PROGRESS: "transfer:progress",
  TRANSFER_COMPLETE: "transfer:complete",
};

// Server → Client
export const MSG_OUT = {
  // Auth
  AUTH_SUCCESS: "auth:success",
  AUTH_ERROR: "auth:error",

  // Room events
  ROOM_CREATED: "room:created",
  ROOM_JOINED: "room:joined",
  ROOM_PEER_JOINED: "room:peer-joined",
  ROOM_PEER_LEFT: "room:peer-left",

  // WebRTC signaling relay
  SIGNAL_OFFER: "signal:offer",
  SIGNAL_ANSWER: "signal:answer",
  SIGNAL_ICE: "signal:ice-candidate",

  // File transfer events
  TRANSFER_METADATA: "transfer:metadata",
  TRANSFER_ACCEPT: "transfer:accept",
  TRANSFER_REJECT: "transfer:reject",
  TRANSFER_PROGRESS: "transfer:progress",
  TRANSFER_COMPLETE: "transfer:complete",

  // Share invitations (sender → friend via REST, delivered realtime over WS)
  SHARE_INVITE: "share:invite",

  // Moment collab invitations (creator → collaborator, delivered over WS)
  MOMENT_COLLAB_INVITE: "moment:collab-invite",
  MOMENT_COLLAB_COMPLETE: "moment:collab-complete",

  // Moment memes (mặt sau thẻ) — báo owner + collab khi có meme mới/đã xóa
  MOMENT_MEME_ADDED: "moment:meme-added",
  MOMENT_MEME_REMOVED: "moment:meme-removed",
  MOMENT_MEME_REACTED: "moment:meme-reacted",

  // Friend presence (online/offline + initial snapshot)
  PRESENCE_ONLINE: "presence:online",
  PRESENCE_OFFLINE: "presence:offline",
  PRESENCE_SNAPSHOT: "presence:snapshot",

  // Errors
  ERROR: "error",
};

// Build a message object
export function buildMessage(type, payload = {}) {
  return JSON.stringify({ type, payload });
}

// Validate incoming message shape
export function parseMessage(raw) {
  try {
    const msg = JSON.parse(raw);
    if (!msg || typeof msg.type !== "string" || !msg.type) {
      return null;
    }
    return { type: msg.type, payload: msg.payload || {} };
  } catch {
    return null;
  }
}

// Room code charset (no ambiguous chars: I, 1, 0, O)
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

export function generateRoomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

// Room expiry: 1 hour
export const ROOM_EXPIRY_MS = 60 * 60 * 1000;
