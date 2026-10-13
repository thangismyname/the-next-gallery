import { Router } from "express";
import authRoutes from "./auth.routes.js";
import mediaRoutes from "./media.routes.js";
import adminRoutes from "./admin.routes.js";
import healthRoutes from "./health.routes.js";
import friendsRoutes from "./friends.routes.js";
import shareRoutes from "./share.routes.js";
import momentsRoutes from "./moments.routes.js";
import developerRoutes from "./developer.routes.js";

const router = Router();

router.use("/api/auth", authRoutes);

router.use("/api/v1/media", mediaRoutes);
router.use("/api/gallery/media", mediaRoutes);

router.use("/api/v1/admin", adminRoutes);
router.use("/api/admin", adminRoutes);

router.use("/api/health", healthRoutes);

router.use("/api/friends", friendsRoutes);
router.use("/api/v1/friends", friendsRoutes);

router.use("/api/share", shareRoutes);
router.use("/api/v1/share", shareRoutes);

router.use("/api/moments", momentsRoutes);
router.use("/api/v1/moments", momentsRoutes);

router.use("/api/developer", developerRoutes);
router.use("/api/v1/developer", developerRoutes);

export default router;
