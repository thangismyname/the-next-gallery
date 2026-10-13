import { auth } from "../lib/auth.js";

export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Chưa đăng nhập" },
      });
    }
    req.user = session.user;
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Chưa đăng nhập" },
      });
    }
    if (session.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Không có quyền truy cập" },
      });
    }
    req.user = session.user;
    next();
  } catch (err) {
    next(err);
  }
}
