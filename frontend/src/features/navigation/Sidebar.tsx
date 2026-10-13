import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useNavItems } from "@/hooks/useNavItems";
import { useResizable } from "@/hooks/useResizable";
import { SidebarNavItem } from "./components/SidebarNavItem";
import { ThemeToggle } from "@/features/toggles/ThemeToggle";
import { LanguageToggle } from "@/features/toggles/LanguageToggle";
import { NavMenuItem } from "@/types";
import { Camera } from "lucide-react";
import { fetchMomentInvitations } from "@/services/moments";

const SECTION_LABEL_KEYS: Record<string, string> = {
  primary: "sidebar.shortcuts",
  library: "sidebar.library",
  personal: "sidebar.personal",
};

function groupBySection(items: NavMenuItem[]) {
  return items.reduce<Record<string, NavMenuItem[]>>((acc, item) => {
    const key = item.section ?? "default";
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const { width, onMouseDown } = useResizable();
  const menuItems = useNavItems();
  const grouped = groupBySection(menuItems);
  const isCollapsed = state === "collapsed";
  const { data: invitations } = useQuery({
    queryKey: ["moments", "invitations"],
    queryFn: fetchMomentInvitations,
    staleTime: 30_000,
  });
  useEffect(() => {
    const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]');
    if (wrapper) {
      (wrapper as HTMLElement).style.setProperty(
        "--sidebar-width",
        `${width}px`,
      );
    }
  }, [width]);

  return (
    <SidebarPrimitive
      collapsible="icon"
      className="top-16 border-r border-border bg-sidebar"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="[&>div]:group-data-[collapsible=icon]:hidden"
            >
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-foreground text-background">
                  <Camera className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {t("app.name")}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("app.tagline", "AI Photo Gallery")}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="items-center">
        {Object.entries(grouped).map(([section, items], idx) => (
          <React.Fragment key={section}>
            {idx > 0 && <SidebarSeparator />}
            <SidebarGroup>
              {!isCollapsed && SECTION_LABEL_KEYS[section] && (
                <SidebarGroupLabel>
                  {t(SECTION_LABEL_KEYS[section])}
                </SidebarGroupLabel>
              )}
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarNavItem
                    key={item.to}
                    item={
                      item.to === "/moments"
                        ? { ...item, badge: invitations?.length ?? 0 }
                        : item
                    }
                  />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </React.Fragment>
        ))}
      </SidebarContent>

      {/* Drag handle — chỉ hiện khi expanded */}
      {!isCollapsed && (
        <div
          onMouseDown={onMouseDown}
          className="group/drag absolute right-0 top-0 z-20 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-border"
        />
      )}

      <SidebarFooter className="border-t border-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-center gap-1 px-2">
              <ThemeToggle />
              <LanguageToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarPrimitive>
  );
};
