import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as shareService from "../services/share.service.js";
import {
  createRoom,
  getPeer,
  getRoom,
  sendToUser,
} from "../ws/services/signaling.service.js";

const router = Router();

// ---- Schemas ----

const createSessionSchema = z.object({
  mediaIds: z.array(z.string().uuid()).min(1, "Cần ít nhất 1 media"),
});

// ---- Routes ----

// GET /api/share/sessions — my share history
router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const sessions = await shareService.getShareSessionsByUser(req.user.id);
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

// GET /api/share/sessions/:id — session details
router.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await shareService.getShareSession(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Không tìm thấy phiên chia sẻ" },
      });
    }

    const receivers = await shareService.getReceivers(session.id);
    res.json({ success: true, data: { ...session, receivers } });
  } catch (error) {
    next(error);
  }
});

// POST /api/share/sessions — create session (REST fallback for non-WS clients)
router.post("/sessions", requireAuth, validate(createSessionSchema, "body"), async (req, res, next) => {
  try {
    const session = await shareService.createShareSession(req.user.id, req.body.mediaIds);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// POST /api/share/sessions/:id/complete — mark complete
router.post("/sessions/:id/complete", requireAuth, async (req, res, next) => {
  try {
    const session = await shareService.completeShareSession(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Không tìm thấy phiên chia sẻ" },
      });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// GET /api/share/friends — friends list for sharing
router.get("/friends", requireAuth, async (req, res, next) => {
  try {
    const friends = await shareService.getFriends(req.user.id);
    res.json({ success: true, data: friends });
  } catch (error) {
    next(error);
  }
});

// POST /api/share/to-friends — send media to friends (creates notifications)
router.post("/to-friends", requireAuth, async (req, res, next) => {
  try {
    const { mediaIds = [], friendIds = [] } = req.body || {};
    if (mediaIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: "NO_MEDIA", message: "Chưa chọn ảnh nào" },
      });
    }
    if (friendIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: "NO_FRIENDS", message: "Chọn ít nhất 1 người nhận" },
      });
    }

    // Create session + add receivers
    const session = await shareService.createShareSession(req.user.id, mediaIds);

    for (const friendId of friendIds) {
      await shareService.addReceiver(session.id, friendId, null);
    }

    // Realtime invite: gửi qua WS tới bạn bè đang online.
    // Ưu tiên dùng phòng signaling đang mở của sender (đang ở ShareDialog);
    // nếu chưa có thì tạo mới để receiver có thể join được.
    let roomCode = null;
    let roomExpiresAt = null;
    const senderPeer = getPeer(req.user.id);
    if (senderPeer?.currentRoomId) {
      const room = getRoom(senderPeer.currentRoomId);
      if (room && Date.now() < room.expiresAt) {
        roomCode = room.code;
        roomExpiresAt = room.expiresAt;
      }
    }
    if (!roomCode) {
      const room = createRoom(req.user.id, mediaIds);
      if (room) {
        roomCode = room.code;
        roomExpiresAt = room.expiresAt;
      }
    }

    if (roomCode) {
      const payload = {
        sessionId: session.id,
        roomCode,
        senderId: req.user.id,
        senderName: req.user.name || req.user.email,
        senderAvatar: req.user.image ?? null,
        mediaCount: mediaIds.length,
        expiresAt: roomExpiresAt,
      };
      friendIds.forEach((friendId) => sendToUser(friendId, "share:invite", payload));
    }

    res.status(201).json({
      success: true,
      data: { sessionId: session.id, receiverCount: friendIds.length },
    });
  } catch (error) {
    next(error);
  }
});

export default router;