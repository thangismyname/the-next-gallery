import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as mediaService from "../services/media.service.js";
import * as embeddingService from "../services/embedding.service.js";
import * as detectionService from "../services/detection.service.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      !file.mimetype.startsWith("image/") &&
      !file.mimetype.startsWith("video/")
    ) {
      return cb(new Error("Chỉ chấp nhận file ảnh hoặc video"));
    }
    cb(null, true);
  },
});

const listMediaQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z
    .enum(["newest", "oldest", "name_asc", "name_desc"])
    .optional()
    .default("newest"),
  type: z.enum(["photo", "video"]).optional(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(120),
});

const backfillBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// Trang Yêu thích hiển thị tất cả ảnh yêu thích — cho phép limit lớn
const listFavoritesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// Thùng rác thường ít mục — cho phép lấy với limit lớn hơn
const listTrashQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const mediaIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

const favoriteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  favorite: z.boolean(),
});

const backfillSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

router.get("/", requireAuth, validate(listMediaQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await mediaService.listMedia(req.user.id, {
      limit: req.query.limit,
      offset: req.query.offset,
      sort: req.query.sort,
      type: req.query.type,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Media yêu thích (is_favorite = true) — dùng cho category card "Favorites" trên Home
router.get("/favorites", requireAuth, validate(listFavoritesQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await mediaService.listFavorites(req.user.id, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Album kèm ảnh đại diện — dùng cho category card "Albums" trên Home
router.get("/albums", requireAuth, validate(listMediaQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await mediaService.listAlbumCovers(req.user.id, {
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Đánh dấu yêu thích / bỏ yêu thích hàng loạt — POST /favorite { ids, favorite }
router.post("/favorite", requireAuth, validate(favoriteSchema), async (req, res, next) => {
  try {
    const { count } = await mediaService.setFavorite(
      req.user.id,
      req.body.ids,
      req.body.favorite,
    );
    res.json({ success: true, data: { updated: count } });
  } catch (error) {
    next(error);
  }
});

// ============ THÙNG RÁC (soft-delete) ============
// DANH SÁCH ảnh trong thùng rác
router.get("/trash", requireAuth, validate(listTrashQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await mediaService.listTrash(req.user.id, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// CHUYỂN VÀO THÙNG RÁC (soft delete) — POST /trash
router.post("/trash", requireAuth, validate(mediaIdsSchema), async (req, res, next) => {
  try {
    const { count } = await mediaService.softDeleteMedia(req.user.id, req.body.ids);
    res.json({ success: true, data: { deleted: count } });
  } catch (error) {
    next(error);
  }
});

// KHÔI PHỤC từ thùng rác
router.post("/restore", requireAuth, validate(mediaIdsSchema), async (req, res, next) => {
  try {
    const { count } = await mediaService.restoreMedia(req.user.id, req.body.ids);
    res.json({ success: true, data: { restored: count } });
  } catch (error) {
    next(error);
  }
});

// XOÁ VĨNH VIỄN (gỡ khỏi DB + MinIO)
router.post("/trash/permanent", requireAuth, validate(mediaIdsSchema), async (req, res, next) => {
  try {
    const { count } = await mediaService.permanentDeleteMedia(req.user.id, req.body.ids);
    res.json({ success: true, data: { deleted: count } });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  requireAuth,
  upload.array("media", 20),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: "NO_FILES", message: "Không có file nào được gửi lên" },
        });
      }
      const uploaded = await mediaService.uploadMedia(req.user.id, req.files);
      res.status(201).json({ success: true, data: { uploaded } });
    } catch (error) {
      next(error);
    }
  },
);

// Tìm ảnh theo tên file — Spotlight search
router.get("/search", requireAuth, validate(searchQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await mediaService.searchMedia(req.user.id, req.query.q);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Tìm album theo tên — Spotlight search
router.get("/albums/search", requireAuth, validate(searchQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await mediaService.searchAlbums(req.user.id, req.query.q);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ============ SEMANTIC SEARCH (OpenCLIP embeddings) ============
// Trạng thái embedding của user: tổng ảnh / đã embed / còn thiếu.
router.get("/embed/status", requireAuth, async (req, res, next) => {
  try {
    const data = await embeddingService.getEmbeddingStats(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Tạo embedding CLIP cho các ảnh cũ chưa xử lý — chạy theo lô.
router.post("/embed/backfill", requireAuth, validate(backfillSchema), async (req, res, next) => {
  try {
    const data = await embeddingService.backfillEmbeddings(req.user.id, {
      limit: req.body.limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ============ OBJECT DETECTION (YOLO26) ============
// Tạo detection YOLO cho các ảnh cũ chưa xử lý — chạy theo lô.
router.post("/detection/backfill", requireAuth, validate(backfillBodySchema), async (req, res, next) => {
  try {
    const data = await detectionService.backfillDetections(req.user.id, {
      limit: req.body.limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Tìm ảnh theo ĐỐI TƯỢNG (class COCO, khớp mờ class_name) — Spotlight search
router.get("/objects/search", requireAuth, validate(searchQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await mediaService.searchMediaObjects(req.user.id, req.query.q);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Danh sách class đã phát hiện (kèm số ảnh) — gợi ý cho ô search
router.get("/objects/classes", requireAuth, async (req, res, next) => {
  try {
    const data = await detectionService.listDetectionClasses(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Thống kê ảnh đã/chưa chạy detection
router.get("/detection/status", requireAuth, async (req, res, next) => {
  try {
    const data = await detectionService.getDetectionStats(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/thumbnail", async (req, res, next) => {
  try {
    const size = req.query.size === "small" ? "small" : "med";
    const info = await mediaService.getThumbnailInfo(req.params.id, size);

    if (!info) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Media not found" },
      });
    }

    if (req.headers["if-none-match"] === info.etag) {
      return res.status(304).end();
    }

    res.setHeader("Content-Type", info.isWebp ? "image/webp" : info.mime || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("ETag", info.etag);

    const stream = await mediaService.createMediaStream(info.bucket, info.objectToStream);
    stream.on("error", (err) => {
      console.error(`Lỗi stream thumbnail ${info.objectToStream}:`, err);
      if (!res.headersSent) res.status(500).json({ success: false, error: { code: "STREAM_ERROR", message: "Stream error" } });
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/file", async (req, res, next) => {
  try {
    const info = await mediaService.getFileInfo(req.params.id);

    if (!info) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Media not found" },
      });
    }

    if (req.headers["if-none-match"] === info.etag) {
      return res.status(304).end();
    }

    res.setHeader("Content-Type", info.mime || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("ETag", info.etag);
    res.setHeader("Accept-Ranges", "bytes");

    const stream = await mediaService.createMediaStream(info.bucket, info.objectToStream);
    stream.on("error", (err) => {
      console.error(`Lỗi stream file ${info.objectToStream}:`, err);
      if (!res.headersSent) res.status(500).json({ success: false, error: { code: "STREAM_ERROR", message: "Stream error" } });
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// Detection (kèm bbox) của 1 ảnh — dùng cho Developer Mode overlay
router.get("/:id/detections", requireAuth, async (req, res, next) => {
  try {
    const data = await detectionService.getMediaDetections(
      req.params.id,
      req.user.id,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
