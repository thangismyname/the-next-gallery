// hooks/useGalleryActions.ts
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { moveToTrash, setFavorite } from "@/services/media";
import { useSelectionStore } from "./useSelectionStore";
import {
  galleryQueryKey,
  galleryQueryPrefix,
} from "./useGalleryMedia";
import { useGalleryActionsStore } from "./useGalleryActionsStore";
import type { MediaListItem } from "@/services/media";

// Cập nhật cache của MỌI kiểu sort trong gallery (newest, oldest, name_asc...).
function updateAllGalleryVariants(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (old: unknown) => unknown,
) {
  const cache = queryClient.getQueryCache();
  const queries = cache.findAll({ queryKey: galleryQueryPrefix });
  queries.forEach((query) => {
    queryClient.setQueryData(query.queryKey, updater);
  });
}

export function useGalleryActions() {
  const clear = useSelectionStore((s) => s.clear);
  const queryClient = useQueryClient();

  // State các dialog nằm trong store dùng chung để GalleryView và MainLayout
  // (nơi thực sự render dialog) tham chiếu cùng 1 nguồn.
  const shareDialogOpen = useGalleryActionsStore((s) => s.shareDialogOpen);
  const shareMediaIds = useGalleryActionsStore((s) => s.shareMediaIds);
  const openShare = useGalleryActionsStore((s) => s.openShare);
  const setShareDialogOpen = useGalleryActionsStore((s) => s.setShareDialogOpen);

  const deleteDialogOpen = useGalleryActionsStore((s) => s.deleteDialogOpen);
  const pendingDeleteIds = useGalleryActionsStore((s) => s.pendingDeleteIds);
  const deleteBusy = useGalleryActionsStore((s) => s.deleteBusy);
  const openDelete = useGalleryActionsStore((s) => s.openDelete);
  const setDeleteBusy = useGalleryActionsStore((s) => s.setDeleteBusy);
  const setDeleteDialogOpen = useGalleryActionsStore(
    (s) => s.setDeleteDialogOpen,
  );
  const closeDeleteDialog = useGalleryActionsStore((s) => s.closeDeleteDialog);

  const handleShare = useCallback(
    (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      openShare(ids);
    },
    [openShare],
  );

  const handleDownload = async (ids: string[]) => {
    // TODO: tạo zip / download từng file
    console.log("download", ids);
  };

  const handleDelete = useCallback(
    (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      openDelete(ids);
    },
    [openDelete],
  );

  // Yêu thích: đọc trạng thái hiện tại từ cache gallery để quyết định thêm/bỏ.
  // Nếu tất cả ảnh đã được yêu thích → bỏ yêu thích; ngược lại → yêu thích.
  // Truyền `ensure` để ép 1 hướng (vd trang Favorites luôn bỏ yêu thích).
  const handleFavorite = useCallback(
    async (ids: string[], ensure?: boolean) => {
      if (!ids || ids.length === 0) return;

      let makeFavorite = ensure;
      if (makeFavorite === undefined) {
        const cached = queryClient.getQueryData<{
          pages: { items: MediaListItem[] }[];
        }>(galleryQueryKey());
        const items = cached?.pages.flatMap((p) => p.items) ?? [];
        const selectedItems = items.filter((m) => ids.includes(m.id));
        makeFavorite =
          selectedItems.length === 0 || !selectedItems.every((m) => m.isFavorite);
      }

      try {
        await setFavorite(ids, makeFavorite);

        const idSet = new Set(ids);
        updateAllGalleryVariants(queryClient, (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            items: page.items.map((m) =>
              idSet.has(m.id) ? { ...m, isFavorite: makeFavorite } : m,
            ),
          }));
          return { ...old, pages };
        });

        // Home card "Favorites" phụ thuộc query này — làm mới để cover cập nhật.
        await queryClient.invalidateQueries({
          queryKey: ["home", "favorites"],
        });
      } catch (error) {
        console.error("Cập nhật yêu thích thất bại:", error);
      }
    },
    [queryClient],
  );

  const confirmDelete = useCallback(async () => {
    if (pendingDeleteIds.length === 0) return;
    setDeleteBusy(true);
    try {
      await moveToTrash(pendingDeleteIds);
      clear();
      setDeleteDialogOpen(false);

      // Loại các ảnh vừa xóa ra khỏi cache ngay — grid cập nhật tức thì,
      // không chờ refetch từ server.
      const deleteSet = new Set(pendingDeleteIds);
      updateAllGalleryVariants(queryClient, (old) => {
        if (!old) return old;
        const pages = old.pages.map((page) => ({
          ...page,
          items: page.items.filter((m) => !deleteSet.has(m.id)),
        }));
        return { ...old, pages };
      });

      await queryClient.invalidateQueries({ queryKey: galleryQueryPrefix });
      await queryClient.invalidateQueries({ queryKey: ["favorites", "media"] });
    } catch (err) {
      console.error("Xóa thất bại:", err);
    } finally {
      setDeleteBusy(false);
    }
  }, [pendingDeleteIds, clear, queryClient, setDeleteBusy, setDeleteDialogOpen]);

  return {
    handleShare,
    handleDownload,
    handleDelete,
    handleFavorite,
    confirmDelete,
    closeDeleteDialog,
    deleteDialogOpen,
    deleteBusy,
    pendingDeleteIds,
    shareDialogOpen,
    setShareDialogOpen,
    shareMediaIds,
  };
}