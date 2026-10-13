import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import * as adminService from "../services/admin.service.js";
import * as developerService from "../services/developer.service.js";

const router = Router();

router.get("/stats", requireAdmin, async (_req, res, next) => {
  try {
    const data = await adminService.getStats();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/stats/charts", requireAdmin, async (_req, res, next) => {
  try {
    const data = await adminService.getStatsCharts();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:userId", requireAdmin, async (req, res, next) => {
  try {
    const data = await adminService.deleteUser(
      req.params.userId,
      req.user?.id
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/developer-requests", requireAdmin, async (req, res, next) => {
  try {
    const status =
      typeof req.query.status === "string" ? req.query.status : null;
    const data = await developerService.listDeveloperRequests(status);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/developer-requests/:id/review",
  requireAdmin,
  async (req, res, next) => {
    try {
      const approve = req.body?.approve === true || req.body?.approve === "true";
      const data = await developerService.reviewDeveloperRequest(
        req.params.id,
        req.user.id,
        approve
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

