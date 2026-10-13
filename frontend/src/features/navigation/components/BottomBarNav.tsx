// features/navigation/components/BottomBarNav.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useNavItems } from "@/hooks/useNavItems";
import { cn } from "@/lib/utils";

export const BottomBarNav: React.FC = () => {
  const navItems = useNavItems();
  const modeItems = navItems.filter((item) => item.isPrimaryMode);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 p-1.5",
        "rounded-full border border-border/60 bg-sidebar/85 backdrop-blur-xl shadow-2xl shadow-black/20",
      )}
    >
      {modeItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "relative flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-300",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground active:scale-95",
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span className="hidden min-[400px]:inline-block font-medium">
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </div>
  );
};
