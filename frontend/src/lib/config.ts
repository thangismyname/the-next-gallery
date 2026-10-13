// Nguồn duy nhất cấu hình base URL — mọi nơi khác (api, authClient) đều import từ đây
// để tránh lệch giá trị fallback giữa các module.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3000/api";
export const AUTH_BASE_URL = API_URL.replace(/\/api\/?$/, "");
// WebSocket URL — convert HTTP(S) to WS(S). Default: ws://localhost:3000/ws
export const WS_URL =
  import.meta.env.VITE_WS_URL ||
  API_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "/ws");
