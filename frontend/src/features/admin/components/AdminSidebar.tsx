// src/features/admin/components/AdminSidebar.tsx
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Users, Images, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/features/toggles/ThemeToggle";
import { LanguageToggle } from "@/features/toggles/LanguageToggle";
import type { AdminNavItem } from "@/types";

const navItems: AdminNavItem[] = [
  { key: "dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { key: "users", to: "/admin/users", icon: Users },
  { key: "photos", to: "/admin/photos", icon: Images },
  { key: "settings", to: "/admin/settings", icon: Settings },
] as const;

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {navItems.map(({ key, to, icon: Icon, end }) => (
        <NavLink
          key={key}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              isActive && "bg-muted font-medium text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {t(`admin.nav.${key}`)}
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Desktop: aside cố định, luôn hiện, không có toggles */}
      <aside className="hidden w-56 shrink-0 border-r border-border/50 bg-background md:flex md:flex-col">
        <AdminNav />
      </aside>

      {/* Mobile: backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity md:hidden",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile: drawer trượt, có toggles ở dưới cùng */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/50 bg-background transition-transform duration-200 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
          <span className="font-mono text-sm uppercase tracking-[0.2em]">
            {t("admin.badge")}
          </span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">{t("admin.header.closeSidebar")}</span>
          </Button>
        </div>

        <AdminNav onNavigate={onClose} />

        <div className="flex items-center gap-2 border-t border-border/50 p-3">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </aside>
    </>
  );
}
