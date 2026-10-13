// ==========================================================
// WebSocket Server — setupWebSocket(server)
// ==========================================================
//
// Attaches a WebSocketServer to an existing http.Server.
// Call this from server.js after creating the http server:
//
//   import { setupWebSocket } from "./ws/index.js";
//   const server = http.createServer(app);
//   setupWebSocket(server);
//   server.listen(PORT, ...);
// ==========================================================

import { WebSocketServer } from "ws";
import { handleConnection } from "./handlers/connection.handler.js";
import { buildMessage } from "./protocol.js";

let wss = null;

export function setupWebSocket(server, options = {}) {
  const path = options.path || "/ws";

  wss = new WebSocketServer({
    server,
    path,
    maxPayload: 1024 * 1024, // 1MB max control message
    clientTracking: true,
  });

  wss.on("connection", (ws, req) => {
    console.log(`[ws] New connection from ${req.socket.remoteAddress} on ${path}`);
    handleConnection(ws, req);
  });

  wss.on("error", (err) => {
    console.error("[ws] WebSocketServer error:", err);
  });

  console.log(`[ws] WebSocket server listening at ${path}`);

  return wss;
}

export function getWSS() {
  return wss;
}

export function broadcastAll(type, payload) {
  if (!wss) return;
  const msg = buildMessage(type, payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}