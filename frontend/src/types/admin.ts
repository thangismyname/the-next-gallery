import { LayoutDashboard } from "lucide-react";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalPhotos: number; // đổi tên khớp response BE (server.js: GET /api/admin/stats trả "totalPhotos", không phải "totalMedias")
}

export interface UserGrowthPoint {
  date: string; // "2026-01", "2026-02"...
  users: number;
}

export interface RoleDistribution {
  role: string;
  count: number;
}

export interface AdminNavItem {
  key: string;
  to: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}