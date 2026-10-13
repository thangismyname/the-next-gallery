import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as developerService from "../services/developer.service.js";

const router = Router();

router.get("/status", requireAuth, async (req, res, next) => {
  try {
    const data = await developerService.getDeveloperStatus(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/request", requireAuth, async (req, res, next) => {
  try {
    const raw = req.body?.message;
    const message =
      typeof raw === "string" && raw.trim().length > 0
        ? raw.trim().slice(0, 1000)
        : null;
    const data = await developerService.requestDeveloper(req.user.id, message);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
