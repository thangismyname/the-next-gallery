// ==========================================================
// Signal Handler — Relay WebRTC signaling messages
// ==========================================================
//
// WebRTC signaling messages (offer/answer/ICE) are forwarded
// from one peer to another within the same room. The server
// doesn't inspect the content — it's just a relay for the peers
// to find each other.
// ==========================================================

import { buildMessage } from "../protocol.js";
import { getPeer, broadcastToRoom, sendToUser, getRoom } from "../services/signaling.service.js";

function sendError(ws, code, message) {
  if (ws.readyState === 1) {
    ws.send(buildMessage("error", { code, message }));
  }
}

// Validate that both sender and receiver are in the same room
function validateSameRoom(senderId, receiverId) {
  const sender = getPeer(senderId);
  const receiver = getPeer(receiverId);

  if (!sender || !receiver) return { ok: false, code: "PEER_NOT_FOUND" };
  if (!sender.currentRoomId || !receiver.currentRoomId) {
    return { ok: false, code: "NOT_IN_ROOM" };
  }
  if (sender.currentRoomId !== receiver.currentRoomId) {
    return { ok: false, code: "NOT_SAME_ROOM" };
  }

  const room = getRoom(sender.currentRoomId);
  return { ok: true, room };
}

// Handle WebRTC offer
export function handleSignalOffer(ws, userId, payload) {
  const { to, offer } = payload;
  if (!to || !offer) {
    sendError(ws, "INVALID_PAYLOAD", "Thiếu thông tin offer");
    return;
  }

  const check = validateSameRoom(userId, to);
  if (!check.ok) {
    sendError(ws, check.code, "Không thể gửi offer");
    return;
  }

  sendToUser(to, "signal:offer", { from: userId, offer });
}

// Handle WebRTC answer
export function handleSignalAnswer(ws, userId, payload) {
  const { to, answer } = payload;
  if (!to || !answer) {
    sendError(ws, "INVALID_PAYLOAD", "Thiếu thông tin answer");
    return;
  }

  const check = validateSameRoom(userId, to);
  if (!check.ok) {
    sendError(ws, check.code, "Không thể gửi answer");
    return;
  }

  sendToUser(to, "signal:answer", { from: userId, answer });
}

// Handle ICE candidate
export function handleSignalIceCandidate(ws, userId, payload) {
  const { to, candidate } = payload;
  if (!to || !candidate) {
    sendError(ws, "INVALID_PAYLOAD", "Thiếu ICE candidate");
    return;
  }

  const check = validateSameRoom(userId, to);
  if (!check.ok) {
    sendError(ws, check.code, "Không thể gửi ICE candidate");
    return;
  }

  sendToUser(to, "signal:ice-candidate", { from: userId, candidate });
}
