import { LucideIcon } from "lucide-react";

export interface NavMenuItem {
  label: string;
  icon: LucideIcon;
  to: string;
  isPrimaryMode?: boolean; // Dùng cho BottomBar
  section?: "primary" | "library" | "personal"; // Phân nhóm lớn cho Sidebar
  badge?: number; // Số hiển thị trên item (vd lời mời moment)
}

export interface Category {
  id: string;
  label: string;
  description?: string;
  href: string;
  coverUrl?: string;
  itemCount?: number;
}