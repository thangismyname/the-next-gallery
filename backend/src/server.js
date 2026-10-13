import "./config/env.js";

import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { ensureBucketExists } from "./config/minio.js";
import { dbPool } from "./config/db.js";
import routes from "./routes/index.js";
import { setupWebSocket } from "./ws/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  }),
);

app.use(express.json());

app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function ensureSchema() {
  const statements = [
    `ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail_small_object TEXT`,
    `ALTER TABLE media ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    `ALTER TABLE media ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false`,
    `CREATE INDEX IF NOT EXISTS idx_media_deleted_at
       ON media (deleted_at)
       WHERE deleted_at IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_media_is_favorite
       ON media (user_id, is_favorite)
       WHERE is_favorite = true`,
    // ── AI phase: embeddings cho semantic search (OpenCLIP + pgvector) ──
    `CREATE EXTENSION IF NOT EXISTS vector`,
    `CREATE TABLE IF NOT EXISTS media_embeddings (
       media_id UUID PRIMARY KEY REFERENCES media (id) ON DELETE CASCADE,
       user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
       model VARCHAR(100) NOT NULL,
       embedding vector(512) NOT NULL,
       created_at TIMESTAMPTZ DEFAULT now(),
       updated_at TIMESTAMPTZ DEFAULT now()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_media_embeddings_user
       ON media_embeddings (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_media_embeddings_hnsw
       ON media_embeddings USING hnsw (embedding vector_cosine_ops)`,
  ];
  for (const statement of statements) {
    try {
      await dbPool.query(statement);
    } catch (err) {
      console.error("❌ Không thể ALTER bảng media:", err.message);
    }
  }
}

async function startServer() {
  await ensureBucketExists();
  await ensureSchema();

  // Create http.Server and attach WebSocket server
  const server = http.createServer(app);
  const wss = setupWebSocket(server, { path: "/ws" });

  server.listen(PORT, () => {
    console.log(
      `🚀 Backend đang chạy tại port ${PORT} (${process.env.NODE_ENV})`,
    );
  });
}

startServer();
