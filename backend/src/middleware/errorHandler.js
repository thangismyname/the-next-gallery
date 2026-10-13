export function errorHandler(err, req, res, _next) {
  console.error(err);

  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";

  res.status(status).json({
    success: false,
    error: {
      code,
      message: err.message || "Lỗi server không xác định",
    },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Không tìm thấy route: ${req.method} ${req.originalUrl}`,
    },
  });
}
