import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ImageCard } from "./components/ImageCard";
import { UploadButton } from "./components/UploadButton";
import { Lightbox } from "./components/Lightbox";
import { SelectionActionBar } from "./components/SelectionActionBar";
import { Media } from "../../types";
import { useGalleryMedia } from "@/hooks/useGalleryMedia";
import { toMedia } from "@/services/media";
import type { GallerySort } from "@/services/media";
import { useSelectionStore } from "@/hooks/useSelectionStore";
import { useGalleryActions } from "@/hooks/useGalleryActions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Loader2 } from "lucide-react";
import { buildDisplayRows, DisplayRow } from "@/utils/mediaGrouping";

export const GalleryView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [sort, setSort] = useState<GallerySort>("newest");
  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useGalleryMedia(sort);

  const pages = useMemo(() => data?.pages ?? [], [data]);
  const mediaList = useMemo(
    () => pages.flatMap((p) => p.items.map(toMedia)),
    [pages],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const isSelecting = useSelectionStore((s) => s.isSelecting);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const toggle = useSelectionStore((s) => s.toggle);
  const clear = useSelectionStore((s) => s.clear);
  const setSelecting = useSelectionStore((s) => s.setSelecting);
  const {
    handleShare,
    handleDownload,
    handleDelete,
    handleFavorite,
  } = useGalleryActions();

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sortOptions = [
    { value: "newest", label: t("gallery.sort.newest") },
    { value: "oldest", label: t("gallery.sort.oldest") },
    { value: "name_asc", label: t("gallery.sort.nameAsc") },
    { value: "name_desc", label: t("gallery.sort.nameDesc") },
  ];

  const handleSortChange = useCallback((value: string) => {
    if (!value) return;
    setSort(value as GallerySort);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Container đo chiều rộng grid (đặt wrapper full width của main)
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(4);

  // Nhãn nhóm thời gian/chữ cái
  const groupLabels = useMemo(
    () => ({
      today: t("gallery.group.today"),
      yesterday: t("gallery.group.yesterday"),
      thisWeek: t("gallery.group.thisWeek"),
      thisMonth: t("gallery.group.thisMonth"),
      undated: t("gallery.group.undated"),
    }),
    [t],
  );

  // Danh sách hàng hiển thị: header (nhóm thời gian/chữ cái) + grid ảnh
  const rows = useMemo(
    () =>
      buildDisplayRows(mediaList, columns, sort, groupLabels, i18n.language),
    [mediaList, columns, sort, groupLabels, i18n.language],
  );
  const rowsRef = useRef<DisplayRow[]>(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Virtualizer theo hàng HỖN HỢP (header row + grid row).
  // Scroll container là window (trang cuộn toàn màn hình như Google Photos).
  const gridWidth = gridWrapRef.current?.clientWidth ?? 0;
  const gridGap = gridWidth >= 640 ? 12 : 8;
  const headerHeight = 44;
  const gridRowHeight = Math.floor((gridWidth - (columns - 1) * gridGap) / columns);
  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (index) => {
      const row = rowsRef.current[index];
      return row?.type === "header" ? headerHeight : gridRowHeight;
    },
    overscan: 4,
    getItemKey: (index) => rowsRef.current[index]?.key ?? index,
  });

  // Đo chiều rộng container để tính số cột theo breakpoint
  useLayoutEffect(() => {
    const el = gridWrapRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth;
      // Breakpoint chuẩn Tailwind: dưới 640px (sm) = mobile, luôn tối thiểu 3 cột.
      // Trên đó giãn cột theo chiều rộng container, giữ aspect ratio vuông.
      if (width < 640) setColumns(3);
      else if (width < 1024) setColumns(4);
      else if (width < 1440) setColumns(5);
      else setColumns(6);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Reset measurements khi số cột đổi (resize viewport)
  useEffect(() => {
    rowVirtualizer.measure();
  }, [columns, rowVirtualizer]);

  // Tự động load thêm khi lướt tới gần đáy (IntersectionObserver)
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: null,
        rootMargin: "800px",
        threshold: 0,
      },
    );

    const currentSentinel = sentinelRef.current;
    observer.observe(currentSentinel);

    return () => {
      if (currentSentinel) observer.unobserve(currentSentinel);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleUploaded = useCallback(() => {
    void refetch();
  }, [refetch]);

  const openPreview = useCallback(
    (media: Media) => {
      const idx = mediaList.findIndex((m) => m.id === media.id);
      if (idx !== -1) setSelectedIndex(idx);
    },
    [mediaList],
  );

  const closePreview = useCallback(() => setSelectedIndex(null), []);

  // Khi xóa ảnh đang mở trong lightbox → cache gallery thu hẹp. Clamp về ảnh cuối
  // còn lại (hoặc đóng lightbox nếu hết ảnh) để index không trỏ ra ngoài mảng.
  useEffect(() => {
    if (selectedIndex === null) return;
    if (mediaList.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (selectedIndex >= mediaList.length) {
      setSelectedIndex(mediaList.length - 1);
    }
  }, [selectedIndex, mediaList.length]);

  const handleToggle = useCallback(
    (media: Media) => {
      toggle(media.id);
      setSelectedIndex(null);
    },
    [toggle],
  );

  // Escape thoát khỏi chế độ chọn
  useEffect(() => {
    if (!isSelecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSelecting, clear]);

  const goPrev = useCallback(
    () =>
      setSelectedIndex((i) =>
        i === null ? null : (i - 1 + mediaList.length) % mediaList.length,
      ),
    [mediaList.length],
  );

  const goNext = useCallback(
    () =>
      setSelectedIndex((i) => (i === null ? null : (i + 1) % mediaList.length)),
    [mediaList.length],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {t("gallery.allPhotos.title")}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t("gallery.allPhotos.itemCount", { count: mediaList.length })}
          </span>
          <Combobox
            value={sort}
            onChange={handleSortChange}
            options={sortOptions}
            placeholder={t("gallery.sort.label")}
            searchPlaceholder={t("gallery.sort.label")}
            className="min-w-[7rem]"
          />
          <Button
            variant={isSelecting ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSelecting(!isSelecting)}
          >
            {isSelecting ? t("gallery.selection.cancel") : t("gallery.selection.select")}
          </Button>
          <UploadButton onUploaded={handleUploaded} />
        </div>
      </div>

      {/* Thông báo lỗi */}
      {isError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-center text-sm">
          {t("gallery.error.loadFailed")}
        </div>
      )}

      {/* Trạng thái load ban đầu (Skeleton Grid) */}
      {isPending ? (
        <div className="grid grid-cols-1 min-[640px]:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 sm:gap-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton
              key={i}
              className="aspect-square rounded-lg bg-muted/40"
            />
          ))}
        </div>
      ) : mediaList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {t("gallery.empty")}
        </div>
      ) : (
        <>
          {/* Gallery Grid (virtualized theo hàng) */}
          <div ref={gridWrapRef}>
            <div
              className="relative w-full"
              style={{ height: `${Math.max(rowVirtualizer.getTotalSize(), 1)}px` }}
            >
              <div
                className="absolute top-0 left-0 w-full"
                style={{
                  transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  if (!row) return null;

                  if (row.type === "header") {
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        className="h-11 flex items-end px-1 pb-1"
                      >
                        <span className="text-sm font-semibold text-foreground/80">
                          {row.label}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      className="grid gap-2 sm:gap-3"
                      style={{
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      }}
                    >
                      {row.items.map((media) => (
                        <ImageCard
                          key={media.id}
                          media={media}
                          onClick={openPreview}
                          selected={selectedIds.has(media.id)}
                          onToggle={isSelecting ? handleToggle : undefined}
                          onLongPress={handleToggle}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sentinel trigger tải tiếp khi cuộn (dùng khi cuộn window chính) */}
          <div ref={sentinelRef} className="h-4 w-full" />

          {/* Indicator khi đang tải thêm ngầm */}
          {isFetchingNextPage && (
            <div className="flex justify-center items-center py-6 gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>{t("gallery.loadingMore", "Đang tải thêm ảnh...")}</span>
            </div>
          )}
        </>
      )}

      {/* Lightbox xem ảnh lớn */}
      {selectedIndex !== null && mediaList[selectedIndex] && !isSelecting && (
        <Lightbox
          media={mediaList[selectedIndex]}
          mediaList={mediaList}
          onClose={closePreview}
          onPrev={mediaList.length > 1 ? goPrev : undefined}
          onNext={mediaList.length > 1 ? goNext : undefined}
          onSelect={setSelectedIndex}
          onToggleFavorite={() => handleFavorite([mediaList[selectedIndex].id])}
          onDelete={() => handleDelete([mediaList[selectedIndex].id])}
        />
      )}

      {/* Toolbar chọn ảnh — desktop (mobile dùng BottomBar sẵn có) */}
      {isSelecting && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hidden sm:block">
          <SelectionActionBar
            onShare={handleShare}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onFavorite={handleFavorite}
          />
        </div>
      )}
    </div>
  );
};
