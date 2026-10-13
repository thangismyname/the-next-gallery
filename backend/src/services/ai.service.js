// Client gọi ai-service (FastAPI) cho các tác vụ AI — hiện dùng cho embedding
// semantic search (OpenCLIP). Native Node 20 có sẵn global fetch/FormData/Blob.

const AI_SERVICE_URL = (
  process.env.AI_SERVICE_URL || "http://localhost:8000"
).replace(/\/+$/, "");

const EMBED_TIMEOUT_MS = Number(process.env.AI_EMBED_TIMEOUT_MS) || 30000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mã hoá 1 ảnh thành vector embedding qua ai-service (CLIP image encoder).
 * @returns {Promise<{ embedding: number[], provider: string, model: string, dimension: number }>}
 */
export async function embedImage(buffer, mimeType, filename = "image") {
  const form = new FormData();
  const blob = new Blob([buffer], {
    type: mimeType || "application/octet-stream",
  });
  form.append("file", blob, filename);

  const response = await fetchWithTimeout(`${AI_SERVICE_URL}/api/v1/embed/image`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI embed image failed (${response.status}): ${detail}`);
  }
  return response.json();
}

/**
 * Mã hoá câu truy vấn text thành vector embedding qua ai-service (CLIP text encoder).
 * @returns {Promise<{ embedding: number[], provider: string, model: string, dimension: number }>}
 */
export async function embedText(text) {
  const response = await fetchWithTimeout(`${AI_SERVICE_URL}/api/v1/embed/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI embed text failed (${response.status}): ${detail}`);
  }
  return response.json();
}

/**
 * Phát hiện object trong 1 ảnh qua ai-service (YOLO26).
 * @returns {Promise<{ provider: string, model: string, detections: {class_name: string, confidence: number, bbox: number[]}[] }>}
 */
export async function detectObjects(buffer, mimeType, filename = "image") {
  const form = new FormData();
  const blob = new Blob([buffer], {
    type: mimeType || "application/octet-stream",
  });
  form.append("file", blob, filename);

  const response = await fetchWithTimeout(
    `${AI_SERVICE_URL}/api/v1/detect/objects`,
    { method: "POST", body: form },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI detect objects failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export { AI_SERVICE_URL };
