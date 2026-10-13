import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as momentsService from "../services/moments.service.js";
import { sendToUser } from "../ws/services/signaling.service.js";

const router = Router();

// ---- Schemas ----

const listFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  offset: z.coerce.number().int().min(0).default(0),
});

const createMomentSchema = z
  .object({
    template: z.enum(["single", "duo_square", "trio_wide"]).default("single"),
    mediaId: z.string().uuid("mediaId không hợp lệ").nullable().optional(),
    mediaIds: z.array(z.string().uuid("mediaId không hợp lệ")).max(3).optional(),
    collaboratorIds: z.array(z.string().min(1, "ID bạn bè không hợp lệ").max(64)).max(2).optional(),
    caption: z.string().max(280).optional(),
    visibility: z.enum(["circle", "public", "private"]).default("circle"),
  })
  .refine((data) => data.template === "single" ? data.mediaId : true, {
    message: "Thiếu mediaId cho template single",
    path: ["mediaId"],
  });

const fillSlotsSchema = z.object({
  mediaIds: z.array(z.string().uuid("mediaId không hợp lệ")).min(1).max(3),
});

const momentParamsSchema = z.object({
  momentId: z.string().uuid("momentId không hợp lệ"),
});

// React: bắt buộc có emoji.
const createReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

// Meme: template + dòng chữ (memegen.link) + caption tùy chọn.
const memeListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const createMemeSchema = z.object({
  templateId: z.string().trim().min(1).max(64),
  // Chữ KHÔNG bắt buộc — bỏ trống thì dùng meme gốc của template.
  lines: z.array(z.string().trim().max(80)).max(5).default([]),
  caption: z.string().trim().max(280).optional(),
});

const memeParamsSchema = z.object({
  momentId: z.string().uuid("momentId không hợp lệ"),
  memeId: z.string().uuid("memeId không hợp lệ"),
});

// ---- Routes ----

// GET /api/moments — feed moments của mình + bạn bè, theo thời gian mới → cũ
// (chỉ moment HOÀN CHỈNH — draft collab chưa đủ slot không hiện ở đây)
router.get("/", requireAuth, validate(listFeedQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await momentsService.listMomentsFeed(req.user.id, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/moments/invitations — draft moment collab tôi cần điền / đang chờ bạn.
router.get("/invitations", requireAuth, async (req, res, next) => {
  try {
    const items = await momentsService.listMomentInvitations(req.user.id);
    res.json({ success: true, data: { items } });
  } catch (error) {
    next(error);
  }
});

// ── Memes (mặt sau thẻ moment khi lật) ──────────────────────────────

// GET /api/moments/memes/templates — danh sách template meme từ memegen.link.
// Phải đặt TRƯỚC GET /:momentId/memes để không bị khớp momentId="memes".
router.get("/memes/templates", requireAuth, async (req, res, next) => {
  try {
    const items = await momentsService.fetchMemeTemplates();
    res.json({ success: true, data: { items } });
  } catch (error) {
    next(error);
  }
});

// GET /api/moments/:momentId/memes — list meme của moment (mới → cũ, phân trang).
router.get(
  "/:momentId/memes",
  requireAuth,
  validate(momentParamsSchema, "params"),
  validate(memeListQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const data = await momentsService.listMomentMemes(
        req.user.id,
        req.params.momentId,
        { limit: req.query.limit, offset: req.query.offset },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/moments/:momentId/memes — thả meme (template + dòng chữ + caption).
router.post(
  "/:momentId/memes",
  requireAuth,
  validate(momentParamsSchema, "params"),
  validate(createMemeSchema),
  async (req, res, next) => {
    try {
      const meme = await momentsService.createMomentMeme(
        req.user.id,
        req.params.momentId,
        req.body,
      );

      // WS: báo cho owner + người trong collab để cập nhật realtime
      const memberIds = await momentsService.getMomentParticipantIds(
        req.params.momentId,
      );
      for (const memberId of memberIds) {
        sendToUser(memberId, "moment:meme-added", {
          momentId: req.params.momentId,
          meme,
        });
      }

      res.status(201).json({ success: true, data: meme });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/moments/:momentId/memes/:memeId — xóa meme của chính mình.
router.delete(
  "/:momentId/memes/:memeId",
  requireAuth,
  validate(memeParamsSchema, "params"),
  async (req, res, next) => {
    try {
      const removed = await momentsService.deleteMomentMeme(
        req.user.id,
        req.params.memeId,
      );
      if (!removed) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Không tìm thấy meme" },
        });
      }

      const memberIds = await momentsService.getMomentParticipantIds(
        req.params.momentId,
      );
      for (const memberId of memberIds) {
        sendToUser(memberId, "moment:meme-removed", {
          momentId: req.params.momentId,
          memeId: req.params.memeId,
        });
      }

      res.json({ success: true, data: { removed: true } });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/moments/:momentId/memes/:memeId/react — tim (❤️) 1 meme (toggle:
// đã tim thì bỏ tim). Trả trạng thái mới để FE cập nhật optimistic.
router.post(
  "/:momentId/memes/:memeId/react",
  requireAuth,
  validate(memeParamsSchema, "params"),
  async (req, res, next) => {
    try {
      const state = await momentsService.toggleMemeReaction(
        req.user.id,
        req.params.memeId,
      );

      // WS: báo cho các thành viên còn lại (người hành động tự cập nhật)
      const memberIds = await momentsService.getMomentParticipantIds(
        req.params.momentId,
      );
      for (const memberId of memberIds) {
        if (memberId === req.user.id) continue;
        sendToUser(memberId, "moment:meme-reacted", {
          momentId: req.params.momentId,
          memeId: req.params.memeId,
          myReact: state.myReact,
          reactCount: state.reactCount,
        });
      }

      res.json({ success: true, data: state });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/moments — đăng moment từ ảnh/video đã có trong gallery.
// single: mediaId. duo_square/trio_wide: mediaIds (self-fill đủ slot) hoặc
// mediaIds (1..slotCount-1 ảnh của bạn) + collaboratorIds điền phần slot còn lại.
router.post("/", requireAuth, validate(createMomentSchema), async (req, res, next) => {
  try {
    const moment = await momentsService.createMoment(req.user.id, req.body);

    // WS: mời bạn bè điền ảnh vào slot (chỉ chế độ collaborative)
    if (req.body.collaboratorIds?.length > 0) {
      const inviterName = req.user.name ?? "Bạn";
      const inviterAvatar = req.user.image ?? null;
      for (const friendId of req.body.collaboratorIds) {
        sendToUser(friendId, "moment:collab-invite", {
          momentId: moment.id,
          template: moment.template,
          slotCount: moment.template === "duo_square" ? 2 : 3,
          inviterId: req.user.id,
          inviterName,
          inviterAvatar,
          expiresIn: 24 * 60 * 60 * 1000,
        });
      }
    }

    res.status(201).json({ success: true, data: moment });
  } catch (error) {
    next(error);
  }
});

// PUT /api/moments/:momentId — chỉnh sửa draft collab của chính mình (chưa đủ slot).
// Chỉ chủ sở hữu + còn đang là draft; đổi template/ảnh/bạn bè → rebuild slots.
const updateMomentSchema = createMomentSchema.refine(
  (data) => data.template !== "single",
  {
    message: "Chỉ có thể chỉnh sửa moment ghép nhiều ảnh (2-3 slot)",
    path: ["template"],
  },
);

router.put(
  "/:momentId",
  requireAuth,
  validate(momentParamsSchema, "params"),
  validate(updateMomentSchema),
  async (req, res, next) => {
    try {
      const { moment, previousCollaboratorIds } =
        await momentsService.updateDraftMoment(
          req.user.id,
          req.params.momentId,
          req.body,
        );

      // WS: chỉ mời lại những bạn bè MỚI được thêm khi chỉnh sửa
      const newCollaborators = (req.body.collaboratorIds ?? []).filter(
        (friendId) => !previousCollaboratorIds.includes(friendId),
      );
      if (newCollaborators.length > 0) {
        const inviterName = req.user.name ?? "Bạn";
        const inviterAvatar = req.user.image ?? null;
        for (const friendId of newCollaborators) {
          sendToUser(friendId, "moment:collab-invite", {
            momentId: moment.id,
            template: moment.template,
            slotCount: moment.template === "duo_square" ? 2 : 3,
            inviterId: req.user.id,
            inviterName,
            inviterAvatar,
            expiresIn: 24 * 60 * 60 * 1000,
          });
        }
      }

      res.json({ success: true, data: moment });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/moments/:momentId/fill — tôi điền ảnh vào slot của mình trong draft collab.
// mediaIds: 1+ ảnh (lấp tuần tự các slot trống của tôi — 1 người giữ nhiều slot thì gửi nhiều ảnh).
router.post(
  "/:momentId/fill",
  requireAuth,
  validate(momentParamsSchema, "params"),
  validate(fillSlotsSchema),
  async (req, res, next) => {
    try {
      const { mediaIds } = req.body;
      const { filled, complete, moment } = await momentsService.fillMomentSlots(
        req.user.id,
        req.params.momentId,
        mediaIds,
      );

      // WS: moment vừa đủ slot → báo tất cả thành viên để refresh feed
      if (complete) {
        const memberIds = new Set(
          [moment.userId, ...moment.slots.map((s) => s.userId)],
        );
        for (const memberId of memberIds) {
          sendToUser(memberId, "moment:collab-complete", {
            momentId: moment.id,
            template: moment.template,
            complete: true,
          });
        }
      }

      res.json({ success: true, data: { filled, complete, moment } });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/moments/:momentId — xóa moment của chính mình
router.delete("/:momentId", requireAuth, validate(momentParamsSchema, "params"), async (req, res, next) => {
  try {
    const removed = await momentsService.deleteMoment(req.user.id, req.params.momentId);
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Không tìm thấy moment" },
      });
    }
    res.json({ success: true, data: { removed: true } });
  } catch (error) {
    next(error);
  }
});

// POST /api/moments/:momentId/leave — người được mời gỡ ảnh của mình khỏi moment
// collab (moment quay về trạng thái chưa đủ slot cho creator điều chỉnh lại).
router.post(
  "/:momentId/leave",
  requireAuth,
  validate(momentParamsSchema, "params"),
  async (req, res, next) => {
    try {
      const item = await momentsService.leaveMoment(
        req.user.id,
        req.params.momentId,
      );
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/moments/:momentId/reactions — react bằng emoji
router.post(
  "/:momentId/reactions",
  requireAuth,
  validate(momentParamsSchema, "params"),
  validate(createReactionSchema),
  async (req, res, next) => {
    try {
      const reaction = await momentsService.createReaction(
        req.user.id,
        req.params.momentId,
        req.body,
      );
      res.status(201).json({ success: true, data: reaction });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/moments/:momentId/reactions — bỏ reaction của mình
router.delete(
  "/:momentId/reactions",
  requireAuth,
  validate(momentParamsSchema, "params"),
  async (req, res, next) => {
    try {
      const removed = await momentsService.deleteReaction(
        req.user.id,
        req.params.momentId,
      );
      if (!removed) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Chưa có reaction để bỏ" },
        });
      }
      res.json({ success: true, data: { removed: true } });
    } catch (error) {
      next(error);
    }
  },
);

export default router;