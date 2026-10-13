import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchMediaByFilter,
  MediaFilter,
  MediaListItem,
} from "@/services/media";
import { fetchFriends } from "@/services/friends";
import { createMoment, updateDraftMoment } from "@/services/moments";
import { Moment, MomentTemplate, MomentVisibility } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  /** Draft moment collab chưa đủ slot — mở ở chế độ chỉnh sửa (quay lại edit). */
  editMoment?: Moment | null;
};

const SLOT_COUNT: Record<MomentTemplate, number> = {
  single: 1,
  duo_square: 2,
  trio_wide: 3,
};

/** Số ảnh mỗi lần tải của picker — 1 trang tối đa backend cho phép. */
const PICKER_PAGE_SIZE = 100;

/** Ảnh minh hoạ template: số ô vuông + tên + label loại. */
function TemplateCard({
  template,
  active,
  onClick,
  title,
  desc,
}: {
  template: MomentTemplate;
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  const cells =
    template === "single" ? 1 : template === "duo_square" ? 2 : 3;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition hover:bg-muted/40",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border",
      )}
    >
      <div
        className={cn(
          "grid w-full max-w-[92px] gap-1",
          template === "single" && "grid-rows-1",
          (template === "duo_square" || template === "trio_wide") && "grid-cols-1 aspect-[4/5]",
          template === "duo_square" && "grid-rows-2",
          template === "trio_wide" && "grid-rows-3",
        )}
      >
        {Array.from({ length: cells }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-[3px] bg-muted",
              template === "single" && "aspect-[4/5]",
              active && "bg-primary/15",
            )}
          />
        ))}
      </div>
      <span className="text-xs font-medium leading-tight">{title}</span>
      <span className="text-[10px] leading-tight text-muted-foreground">
        {desc}
      </span>
    </button>
  );
}

export const CreateMomentDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  onCreated,
  editMoment,
}) => {
  const { t } = useTranslation();
  const isEditing = Boolean(editMoment);
  const [template, setTemplate] = useState<MomentTemplate>("single");
  const [mode, setMode] = useState<"self" | "collab">("collab");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<MomentVisibility>("circle");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Picker ảnh: bộ lọc + phân trang (mỗi trang 100 ảnh) ──
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [mediaItems, setMediaItems] = useState<MediaListItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerLoadingMore, setPickerLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const slotCount = SLOT_COUNT[template];
  const isCollabTemplate = template !== "single";

  // Load trang đầu khi mở dialog hoặc đổi bộ lọc.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPickerLoading(true);
    setMediaItems([]);
    setHasMore(false);
    fetchMediaByFilter(filter, 0, PICKER_PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setMediaItems(page.items);
        setHasMore(page.hasMore);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, filter]);

  // Khi mở dialog: seed dữ liệu từ draft (edit mode) hoặc reset (tạo mới).
  useEffect(() => {
    if (!open) return;
    if (editMoment) {
      const editSlotCount =
        SLOT_COUNT[editMoment.template === "single" ? "duo_square" : editMoment.template] ??
        SLOT_COUNT.duo_square;
      // Creator của draft (có thể giữ 1-N slot) + các bạn được mời (theo slot, dedupe).
      const collaborators = [
        ...new Set(
          (editMoment.slots ?? [])
            .filter((s) => s.userId && s.userId !== editMoment.userId)
            .map((s) => s.userId),
        ),
      ];
      const ownPhotoIds = (editMoment.slots ?? [])
        .filter((s) => s.userId === editMoment.userId && s.mediaId)
        .map((s) => s.mediaId as string);
      setTemplate(editMoment.template !== "single" ? editMoment.template : "duo_square");
      setMode("collab");
      setSelectedIds(ownPhotoIds);
      setFriendIds(
        collaborators.slice(
          0,
          Math.max(1, editSlotCount - Math.max(ownPhotoIds.length, 1)),
        ),
      );
      setCaption(editMoment.caption ?? "");
      setVisibility(editMoment.visibility ?? "circle");
      setError(null);
    } else {
      setTemplate("single");
      setMode("collab");
      setSelectedIds([]);
      setFriendIds([]);
      setCaption("");
      setVisibility("circle");
      setError(null);
    }
  }, [open, editMoment]);

  // Load thêm trang kế tiếp, nối vào danh sách hiện tại.
  const loadMore = useCallback(async () => {
    if (pickerLoadingMore || !hasMore) return;
    setPickerLoadingMore(true);
    try {
      const page = await fetchMediaByFilter(
        filter,
        mediaItems.length,
        PICKER_PAGE_SIZE,
      );
      setMediaItems((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...page.items.filter((m) => !seen.has(m.id))];
      });
      setHasMore(page.hasMore);
    } catch {
      // silent
    } finally {
      setPickerLoadingMore(false);
    }
  }, [filter, hasMore, mediaItems.length, pickerLoadingMore]);

  const filterOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "all", label: t("moments.filterAll") },
      { value: "favorites", label: t("moments.filterFavorites") },
      { value: "photos", label: t("moments.filterPhotos") },
      { value: "videos", label: t("moments.filterVideos") },
    ],
    [t],
  );

  const { data: friendsData, isPending: friendsPending } = useQuery({
    queryKey: ["friends", "list"],
    queryFn: fetchFriends,
    enabled: open && isCollabTemplate,
    staleTime: 60_000,
  });

  const friends = friendsData ?? [];

  // Số ảnh tối đa chọn được:
  // - single/self: đủ slot
  // - collab: slotCount trừ slot đã giành cho bạn bè (nhưng phải chừa tối thiểu
  //   1 slot cho ít nhất 1 bạn — creator không thể chiếm hết khi đang chế độ "Cùng bạn").
  // Ảnh chưa chọn? Giữ `photoLimit >= 1` để luôn còn chỗ cho bạn bè.
  const photoLimit = isCollabTemplate
    ? mode === "self"
      ? slotCount
      : Math.max(1, Math.min(slotCount - friendIds.length, slotCount - 1))
    : 1;
  // Collab: chọn bao nhiêu bạn tuỳ theo số ảnh của mình (creator phải chừa ≥1 slot).
  const maxFriendCount = isCollabTemplate && mode === "collab"
    ? Math.max(1, slotCount - Math.max(selectedIds.length, 1))
    : 0;

  const reset = () => {
    setTemplate("single");
    setMode("collab");
    setSelectedIds([]);
    setFriendIds([]);
    setCaption("");
    setVisibility("circle");
    setError(null);
  };

  const toggleMedia = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      // Chọn 1 ảnh (single / collab chừa đúng 1 slot): bấm ảnh khác sẽ thay thế.
      if (photoLimit === 1) return [id];
      return prev.length >= photoLimit ? prev : [...prev, id];
    });
  };

  const toggleFriend = (id: string) => {
    setFriendIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return prev.length >= maxFriendCount ? prev : [...prev, id];
    });
  };

  const canPost = useMemo(() => {
    if (isCollabTemplate && mode === "collab") {
      return (
        selectedIds.length >= 1 &&
        friendIds.length >= 1 &&
        selectedIds.length + friendIds.length <= slotCount
      );
    }
    return selectedIds.length >= photoLimit;
  }, [isCollabTemplate, mode, selectedIds, friendIds, photoLimit, slotCount]);

  const handlePost = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    setError(null);
    try {
      if (isEditing && editMoment) {
        await updateDraftMoment(editMoment.id, {
          template,
          mediaIds: selectedIds,
          collaboratorIds: friendIds,
          caption: caption.trim() || undefined,
          visibility,
        });
      } else if (isCollabTemplate && mode === "collab") {
        await createMoment({
          template,
          mediaIds: selectedIds,
          collaboratorIds: friendIds,
          caption: caption.trim() || undefined,
          visibility,
        });
      } else if (isCollabTemplate && mode === "self") {
        await createMoment({
          template,
          mediaIds: selectedIds,
          caption: caption.trim() || undefined,
          visibility,
        });
      } else {
        await createMoment({
          template: "single",
          mediaId: selectedIds[0],
          caption: caption.trim() || undefined,
          visibility,
        });
      }
      onCreated();
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("moments.editDraft") : t("moments.newMoment")}
          </DialogTitle>
          <DialogDescription>{t("moments.selectTemplate")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Bước 1 — Chọn template (edit mode chỉ cho template ghép nhiều ảnh) */}
          <div className="flex gap-2">
            {!isEditing && (
              <TemplateCard
                template="single"
                active={template === "single"}
                onClick={() => {
                  setTemplate("single");
                  setSelectedIds([]);
                }}
                title={t("moments.templateSingle")}
                desc={t("moments.templateSingleDesc")}
              />
            )}
            <TemplateCard
              template="duo_square"
              active={template === "duo_square"}
              onClick={() => {
                setTemplate("duo_square");
                setSelectedIds([]);
              }}
              title={t("moments.templateDuo")}
              desc={t("moments.templateDuoDesc")}
            />
            <TemplateCard
              template="trio_wide"
              active={template === "trio_wide"}
              onClick={() => {
                setTemplate("trio_wide");
                setSelectedIds([]);
              }}
              title={t("moments.templateTrio")}
              desc={t("moments.templateTrioDesc")}
            />
          </div>

          {/* Bước 2 — Chế độ (chỉ template duo/trio + tạo mới) */}
          {isCollabTemplate && !isEditing && (
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setMode("collab")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 transition",
                  mode === "collab"
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {t("moments.modeCollab")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("self");
                  setFriendIds([]);
                }}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 transition",
                  mode === "self"
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {t("moments.modeSelf")}
              </button>
            </div>
          )}

          {/* Chọn bạn bè (chế độ collab) */}
          {isCollabTemplate && mode === "collab" && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {maxFriendCount > 1
                  ? t("moments.selectFriendsRange", { max: maxFriendCount })
                  : t("moments.selectFriends", { n: maxFriendCount })}
              </p>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {friendsPending ? (
                  <Skeleton className="h-7 w-full rounded-md bg-muted/40" />
                ) : friends.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70">
                    {t("moments.noFriends")}
                  </p>
                ) : (
                  friends.map((friend) => {
                    const active = friendIds.includes(friend.id);
                    return (
                      <button
                        key={friend.id}
                        type="button"
                        onClick={() => toggleFriend(friend.id)}
                        className={cn(
                          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition hover:bg-muted/40",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border",
                        )}
                        title={friend.name}
                      >
                        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-semibold">
                          {friend.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{friend.name}</span>
                        {active && <Check className="size-3 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Bước 3 — Picker ảnh */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <p className="text-muted-foreground">
                {isCollabTemplate && mode === "collab"
                  ? t("moments.yourPhotoSlots", {
                      min: 1,
                      max: photoLimit,
                      total: slotCount,
                    })
                  : t("moments.selectPhoto")}
              </p>
              <p
                className={cn(
                  "font-medium",
                  isCollabTemplate &&
                    selectedIds.length < photoLimit
                    ? "text-amber-500"
                    : "text-primary",
                )}
              >
                {selectedIds.length}/{photoLimit}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Combobox
                value={filter}
                onChange={(value) => {
                  if (value && value !== filter) {
                    setFilter(value as MediaFilter);
                    setSelectedIds([]);
                  }
                }}
                options={filterOptions}
                placeholder={t("moments.filterAll")}
                searchPlaceholder={t("moments.filterSearch")}
                emptyText={t("moments.filterEmpty")}
                className="w-[150px]"
              />
              <span className="text-[11px] text-muted-foreground">
                {t("moments.photoCount", { n: mediaItems.length })}
              </span>
            </div>
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto pr-1">
              {pickerLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className="aspect-square rounded-lg bg-muted/40"
                    />
                  ))
                : mediaItems.length === 0
                  ? (
                    <span className="col-span-4 py-6 text-center text-xs text-muted-foreground">
                      {t("moments.filterEmpty")}
                    </span>
                  )
                  : mediaItems.map((item) => {
                      const selected = selectedIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleMedia(item.id)}
                          className={cn(
                            "relative aspect-square overflow-hidden rounded-lg transition",
                            selected && "ring-2 ring-primary",
                            !selected && "hover:opacity-80",
                          )}
                          title={item.title ?? ""}
                        >
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title ?? ""}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                          {item.mediaType === "video" && (
                            <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[9px] text-white">
                              {t("moments.video")}
                            </span>
                          )}
                          {selected && (
                            <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
            </div>
            {hasMore && !pickerLoading && (
              <div className="flex justify-center pt-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadMore}
                  disabled={pickerLoadingMore}
                >
                  {pickerLoadingMore ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    t("moments.loadMore")
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder={t("moments.captionPlaceholder")}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />

          {/* Visibility */}
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {t("moments.visibility")}
            </span>
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as MomentVisibility)
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="circle">{t("moments.visibilityCircle")}</option>
              <option value="public">{t("moments.visibilityPublic")}</option>
              <option value="private">{t("moments.visibilityPrivate")}</option>
            </select>
          </label>

          {/* Ghi chú chế độ collab */}
          {isCollabTemplate && mode === "collab" && (
            <div className="space-y-1">
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Users className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {t("moments.collabHint")}
              </p>
              {maxFriendCount > 1 && (
                <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                  {t("moments.collabSplitHint")}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={posting}
          >
            {t("moments.cancel")}
          </Button>
          <Button onClick={handlePost} disabled={!canPost || posting}>
            {posting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isEditing ? (
              t("moments.saveChanges")
            ) : (
              t("moments.post")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};