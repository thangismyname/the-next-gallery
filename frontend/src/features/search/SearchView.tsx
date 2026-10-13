import React, { useCallback, useEffect, useState } from "react";
import { SearchBar } from "./components/SearchBar";
import { useDebounce } from "@/hooks/useDebounce";
import { searchGallerySemantic, searchGalleryObjects, searchAlbums, toMedia, MediaListItem, AlbumSearchResult } from "@/services/media";
import { searchFriend, FriendSearchResult } from "@/services/friends";
import { useGalleryActionsStore } from "@/hooks/useGalleryActionsStore";
import { Loader2, Search, User, Image, FolderOpen, Boxes, GripHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Lightbox } from "@/features/gallery/components/Lightbox";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { useDraggablePanel } from "@/hooks/useDraggablePanel";
import { Media } from "@/types";

interface SearchViewProps {
  open: boolean;
  onClose: () => void;
}

interface SearchState {
  friends: FriendSearchResult[];
  albums: AlbumSearchResult[];
  media: MediaListItem[];
  objects: MediaListItem[];
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: SearchState = {
  friends: [],
  albums: [],
  media: [],
  objects: [],
  loading: false,
  error: null,
};

const PANEL_STORAGE_KEY = "tng.searchPanelSize";
const PANEL_POS_STORAGE_KEY = "tng.searchPanelPos";
const PANEL_DEFAULT_WIDTH = 672; // ~max-w-2xl
const PANEL_MIN_WIDTH = 380;
const PANEL_MIN_HEIGHT = 260;

export const SearchView: React.FC<SearchViewProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchState>(INITIAL_STATE);
  const debouncedQuery = useDebounce(query, 400);
  const openShare = useGalleryActionsStore((s) => s.openShare);
  const { t } = useTranslation();

  const defaultPanelHeight =
    typeof window === "undefined"
      ? 480
      : Math.round(window.innerHeight * 0.6);

  const { size: panelSize, shiftX, isResizing, startResize, reset } =
    useResizablePanel({
      storageKey: PANEL_STORAGE_KEY,
      defaultWidth: PANEL_DEFAULT_WIDTH,
      defaultHeight: defaultPanelHeight,
      minWidth: PANEL_MIN_WIDTH,
      minHeight: PANEL_MIN_HEIGHT,
    });

  const { panelRef, pos, isDragging, startDrag, resetPos } = useDraggablePanel({
    storageKey: PANEL_POS_STORAGE_KEY,
  });

  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, button, a, kbd, [data-no-drag]")) {
        return;
      }
      e.preventDefault();
      startDrag(e);
    },
    [startDrag],
  );

  const handleResetPanel = useCallback(() => {
    reset();
    resetPos();
  }, [reset, resetPos]);

  // Lightbox mở khi bấm 1 ảnh trong kết quả tìm kiếm (kèm điều hướng trong nhóm)
  const [lightbox, setLightbox] = useState<{
    list: Media[];
    index: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(INITIAL_STATE);
      setLightbox(null);
    }
  }, [open]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(INITIAL_STATE);
      return;
    }

    const controller = new AbortController();
    setResults((prev) => ({ ...prev, loading: true, error: null }));

    const q = debouncedQuery.trim();

    Promise.allSettled([
      searchFriend(q).catch(() => null),
      searchAlbums(q, controller.signal),
      searchGallerySemantic(q, controller.signal),
      searchGalleryObjects(q, controller.signal),
    ]).then(([friendRes, albumRes, mediaRes, objectRes]) => {
      if (controller.signal.aborted) return;

      const friends: FriendSearchResult[] =
        friendRes.status === "fulfilled" && friendRes.value ? [friendRes.value] : [];
      const albums: AlbumSearchResult[] =
        albumRes.status === "fulfilled" ? albumRes.value : [];
      const media: MediaListItem[] =
        mediaRes.status === "fulfilled" ? mediaRes.value : [];
      const objects: MediaListItem[] =
        objectRes.status === "fulfilled" ? objectRes.value : [];

      setResults({ friends, albums, media, objects, loading: false, error: null });
    }).catch(() => {
      if (!controller.signal.aborted) {
        setResults((prev) => ({ ...prev, loading: false, error: t("search.error") }));
      }
    });

    return () => controller.abort();
  }, [debouncedQuery, t]);

  const handleSendToFriend = useCallback(
    (friendId: string) => {
      openShare([], { friendId });
      onClose();
    },
    [openShare, onClose],
  );

  const openLightbox = useCallback(
    (items: MediaListItem[], item: MediaListItem) => {
      if (items.length === 0) return;
      const index = Math.max(
        0,
        items.findIndex((m) => m.id === item.id),
      );
      setLightbox({ list: items.map(toMedia), index });
      onClose();
    },
    [onClose],
  );

  if (!open && !lightbox) return null;

  const hasResults =
    results.friends.length > 0 ||
    results.albums.length > 0 ||
    results.media.length > 0 ||
    results.objects.length > 0;

  const hasQuery = debouncedQuery.trim().length > 0;

  return (
    <>
    {open && (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={cn(
          "relative flex flex-col max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)]",
          "bg-card border border-border rounded-xl shadow-2xl overflow-hidden",
          "animate-in zoom-in-95 duration-200",
          (isResizing || isDragging) && "select-none",
        )}
        style={{
          width: panelSize.width,
          height: panelSize.height,
          transform: `translate(${pos.x + shiftX}px, ${pos.y}px)`,
        }}
      >
        <div
          className="p-3 border-b border-border flex items-center gap-2 cursor-move select-none"
          onPointerDown={handleHeaderPointerDown}
          title={t("search.dragHint")}
        >
          <GripHorizontal
            className="h-4 w-4 shrink-0 cursor-grab touch-none text-muted-foreground/60"
            aria-hidden
          />
          <div className="flex-1 cursor-auto">
            <SearchBar
              value={query}
              onChange={setQuery}
              onClear={() => setQuery("")}
              autoFocus
              placeholder={t("search.placeholder")}
            />
          </div>
          <kbd
            onClick={onClose}
            className="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border border-border bg-muted px-2 font-mono text-[10px] text-muted-foreground cursor-pointer hover:bg-accent"
          >
            ESC
          </kbd>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {results.loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {t("search.searching")}
            </div>
          )}

          {!results.loading && results.error && (
            <div className="text-center py-10 text-destructive text-sm">
              {results.error}
            </div>
          )}

          {!results.loading && hasQuery && !hasResults && !results.error && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Search className="h-6 w-6 mb-2" />
              <span className="text-sm">{t("search.noResults")}</span>
            </div>
          )}

          {!results.loading && hasResults && (
            <div className="space-y-4">
              {results.friends.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("search.friendResults")} ({results.friends.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {results.friends.map((item) => (
                      <button
                        key={item.user.id}
                        onClick={() => handleSendToFriend(item.user.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2 rounded-lg",
                          "hover:bg-accent/50 transition-colors text-left",
                        )}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={item.user.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {item.user.name?.charAt(0)?.toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {item.user.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.user.email}
                          </div>
                        </div>
                        <span className="text-xs text-primary shrink-0">
                          {t("search.sendToFriend")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.albums.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("search.albumResults")} ({results.albums.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {results.albums.map((album) => (
                      <div
                        key={album.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        {album.coverUrl ? (
                          <img
                            src={album.coverUrl}
                            alt={album.name}
                            className="h-10 w-10 rounded object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {album.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {album.mediaCount} {t("search.photos")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.media.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Image className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("search.mediaResults")} ({results.media.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {results.media.map((item) => (
                      <button
                        key={item.id}
                        className="relative aspect-square rounded-md overflow-hidden group focus:outline-none focus:ring-2 focus:ring-ring"
                        onClick={() => openLightbox(results.media, item)}
                      >
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title ?? ""}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {typeof item.score === "number" && (
                          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {Math.round(item.score * 100)}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.objects.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("search.objectResults")} ({results.objects.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {results.objects.map((item) => (
                      <button
                        key={item.id}
                        className="relative aspect-square rounded-md overflow-hidden group focus:outline-none focus:ring-2 focus:ring-ring"
                        onClick={() => openLightbox(results.objects, item)}
                      >
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title ?? ""}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {typeof item.score === "number" && (
                          <span className="absolute bottom-1 left-1 rounded bg-primary/80 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                            {Math.round(item.score * 100)}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasQuery && !results.loading && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {t("search.hint")}
            </div>
          )}
        </div>

        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 right-4 z-10 select-none text-[10px] leading-none text-muted-foreground/50"
        >
          {t("search.resetHint")}
        </span>

        <button
          type="button"
          aria-label={t("search.resizeHandle")}
          title={t("search.resizeHandle")}
          onPointerDown={startResize}
          onDoubleClick={handleResetPanel}
          className={cn(
            "absolute bottom-0 right-0 z-10 h-4 w-4 touch-none select-none",
            "cursor-nwse-resize rounded-br-xl text-muted-foreground/50",
            "hover:text-foreground transition-colors",
          )}
        >
          <svg viewBox="0 0 16 16" className="h-full w-full" fill="none">
            <path
              d="M14 6 L6 14 M14 10 L10 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
    )}

    {lightbox && (
      <Lightbox
        media={lightbox.list[lightbox.index]}
        mediaList={lightbox.list}
        onClose={() => setLightbox(null)}
        onPrev={
          lightbox.index > 0
            ? () =>
                setLightbox((s) =>
                  s ? { ...s, index: s.index - 1 } : s,
                )
            : undefined
        }
        onNext={
          lightbox.index < lightbox.list.length - 1
            ? () =>
                setLightbox((s) =>
                  s ? { ...s, index: s.index + 1 } : s,
                )
            : undefined
        }
      />
    )}
    </>
  );
};
