import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Image, Sparkles, Folder, Users, Heart, Share2, Trash2, Clock3 } from "lucide-react";
import { NavMenuItem } from "@/types";

export function useNavItems(): NavMenuItem[] {
  const { t } = useTranslation();

  return useMemo(
    () => [
      // --- NHÓM 1: CHẾ ĐỘ CHÍNH (PRIMARY MODES) ---
      {
        label: t("navigation.capture"),
        icon: Camera,
        to: "/capture",
        isPrimaryMode: true,
        section: "primary",
      },
      {
        label: t("sidebar.gallery"),
        icon: Image,
        to: "/gallery",
        isPrimaryMode: true,
        section: "primary",
      },
      {
        label: t("navigation.aiEdit"),
        icon: Sparkles,
        to: "/ai-tagged",
        isPrimaryMode: true,
        section: "primary",
      },
      // --- NHÓM 2: THƯ VIỆN (LIBRARY) ---
      {
        label: t("sidebar.albums"),
        icon: Folder,
        to: "/albums",
        section: "library",
      },
      {
        label: t("sidebar.friends"),
        icon: Users,
        to: "/friends",
        section: "library",
      },
      {
        label: t("sidebar.moments"),
        icon: Clock3,
        to: "/moments",
        section: "library",
      },
      // --- NHÓM 2B: CHIA SẺ (SHARE) ---
      {
        label: t("sidebar.share"),
        icon: Share2,
        to: "/share",
        section: "library",
      },
      {
        label: t("sidebar.trash"),
        icon: Trash2,
        to: "/trash",
        section: "library",
      },
      // --- NHÓM 3: CÁ NHÂN & ƯU THÍCH (PERSONAL) ---
      {
        label: t("sidebar.favorites"),
        icon: Heart,
        to: "/favorites",
        section: "personal",
      },
    ],
    [t]
  );
}