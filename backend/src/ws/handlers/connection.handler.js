// ==========================================================
// Connection Handler — Auth + message router
// ==========================================================
//
// Handles the WebSocket connection lifecycle:
// - Authenticates the user from the upgrade request cookies
// - Registers the peer in the signaling service
// - Routes incoming messages to the correct handler
// - Cleans up on disconnect
// ==========================================================

import { auth } from "../../lib/auth.js";
import { buildMessage, parseMessage } from "../protocol.js";
import {
  registerPeer,
  removePeer,
  getPeer,
} from "../services/signaling.service.js";
import {
  handleSignalOffer,
  handleSignalAnswer,
  handleSignalIceCandidate,
} from "./signal.handler.js";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleRoomLeave,
  getCurrentRoomInfo,
} from "./room.handler.js";
import {
  handleTransferMetadata,
  handleTransferAccept,
  handleTransferReject,
  handleTransferProgress,
  handleTransferComplete,
} from "./transfer.handler.js";
import {
  broadcastOnline,
  broadcastOffline,
  sendSnapshot,
} from "../services/presence.service.js";

// Functions that may be async
const HANDLERS = {
  "room:create": handleCreateRoom,
  "room:join": handleJoinRoom,
  "room:leave": handleRoomLeave,
  "signal:offer": handleSignalOffer,
  "signal:answer": handleSignalAnswer,
  "signal:ice-candidate": handleSignalIceCandidate,
  "transfer:metadata": handleTransferMetadata,
  "transfer:accept": handleTransferAccept,
  "transfer:reject": handleTransferReject,
  "transfer:progress": handleTransferProgress,
  "transfer:complete": handleTransferComplete,
};

// Handlers that need the ws instance too (createRoom sends via helper, but
// join doesn't need ws — join uses sendToUser. CreateRoom won't need ws either.
// We pass ws anyway for fallback error sends.)
export function handleConnection(ws, req) {
  // Immediately register a pending-state socket
  let userId = null;
  let isAuthenticated = false;

  // ---- Message router ----
  // Messages are processed sequentially (one at a time) so queued messages
  // sent right after `auth` (e.g. room:create) never race a pending getSession.
  let queue = Promise.resolve();
  ws.on("message", (raw) => {
    queue = queue.then(async () => {
      const msg = parseMessage(raw);
      if (!msg) {
        sendError(ws, "BAD_MESSAGE", "Tin nhắn không hợp lệ");
        return;
      }

      // Auth must come first
      if (msg.type === "auth") {
        await handleAuth(ws, msg.payload);
        return;
      }

      // All other messages require auth
      if (!isAuthenticated || !userId) {
        sendError(ws, "UNAUTHORIZED", "Chưa xác thực");
        return;
      }

      const handler = HANDLERS[msg.type];
      if (!handler) {
        sendError(ws, "UNKNOWN_TYPE", `Không hỗ trợ message: ${msg.type}`);
        return;
      }

      await handler(ws, userId, msg.payload);
    });
    queue.catch((err) => {
      console.error(`[ws] handler error:`, err);
      sendError(ws, "HANDLER_ERROR", "Lỗi server khi xử lý tin nhắn");
    });
  });

  // ---- Auth ----
  async function handleAuth(ws, payload) {
    try {
      // Try cookie-based auth first (from upgrade request)
      const session = await auth.api.getSession({ headers: req.headers });
      if (session?.user) {
        userId = session.user.id;
        isAuthenticated = true;
        // Only broadcast "came online" if this is the first live socket
        const isFirstSocket = !getPeer(userId);
        const peer = registerPeer(
          userId,
          session.user.name || "Anonymous",
          session.user.image || null,
          ws,
        );
        ws.send(
          buildMessage("auth:success", {
            userId: peer.userId,
            username: peer.username,
          }),
        );
        if (isFirstSocket) {
          void broadcastOnline(userId).catch((err) =>
            console.error("[ws] presence online error:", err),
          );
        }
        // Always refresh snapshot so reconnecting/multi-tab users get the list
        void sendSnapshot(userId).catch((err) =>
          console.error("[ws] presence snapshot error:", err),
        );
        return;
      }

      // Fallback: token in payload
      if (payload && payload.token) {
        // TODO: validate token-based auth if needed
        sendError(ws, "AUTH_FAILED", "Token auth chưa được hỗ trợ");
        return;
      }

      sendError(ws, "AUTH_FAILED", "Chưa đăng nhập");
    } catch (err) {
      console.error("[ws] auth error:", err);
      sendError(ws, "AUTH_ERROR", "Lỗi khi xác thực");
    }
  }

  // ---- Disconnect cleanup ----
  ws.on("close", () => {
    if (userId) {
      removePeer(userId, ws);
      // Only notify friends when the last socket closes (user fully offline)
      if (!getPeer(userId)) {
        void broadcastOffline(userId).catch((err) =>
          console.error("[ws] presence offline error:", err),
        );
      }
      console.log(`[ws] User ${userId} disconnected`);
    }
  });

  ws.on("error", (err) => {
    console.error("[ws] connection error:", err.message);
  });
}

function sendError(ws, code, message) {
  if (ws.readyState === 1) {
    ws.send(buildMessage("error", { code, message }));
  }
}

// Re-export for debugging: get current room info on reconnect
export { getCurrentRoomInfo };
