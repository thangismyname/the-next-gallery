// Barrel file — giữ để không phải sửa import cũ (from "../../../services/api")
// ở các component đang dùng. Base URL thật sự nằm ở lib/config.ts.
export { API_URL as BASE_URL } from "@/lib/config";

export * from "./media";
export * from "./upload";
export * from "./friends";