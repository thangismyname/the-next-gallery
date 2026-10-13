import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, CheckSquare2 } from "lucide";
import { Check, Film, ImageIcon, Loader2, Search, Users } from "lucide-react";
import { MorphIcon } from "morphicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL } from "@/lib/config";
import { cn } from "@/lib/utils";
import { fetchMedia, fetchFavorites, MediaListItem } from "@/services/media";

type MediaCategory = "gallery" | "favorites";

interface Friend {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

interface FriendsTabProps {
  mediaIds: string[];
  initialFriendId?: string | null;
}

export const FriendsTab: React.FC<FriendsTabProps> = ({
  mediaIds,
  initialFriendId,
}) => {
  const { t } = useTranslation();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    initialFriendId ? { [initialFriendId]: true } : {},
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Media picker
  const [category, setCategory] = useState<MediaCategory>("gallery");
  const [media, setMedia] = useState<MediaListItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [picked, setPicked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    mediaIds.forEach((id) => {
      init[id] = true;
    });
    return init;
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/share/friends`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        const data = json.data ?? [];
        if (mounted) setFriends(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) setFriends([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setMediaLoading(true);
      setMedia([]);
      try {
        const items: MediaListItem[] = [];
        const pageSize = 100;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const page =
            category === "favorites"
              ? await fetchFavorites(offset, pageSize)
              : await fetchMedia(offset, pageSize);
          items.push(...page.items);
          hasMore = page.hasMore && page.items.length > 0;
          offset += page.items.length;
        }
        if (mounted) setMedia(items);
      } catch {
        if (mounted) setMedia([]);
      } finally {
        if (mounted) setMediaLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [category]);

  const toggle = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMedia = (id: string) => {
    setPicked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedIds = Object.entries(selected)
    .filter(([, value]) => value)
    .map(([id]) => id);

  const pickedIds = Object.entries(picked)
    .filter(([, value]) => value)
    .map(([id]) => id);

  const canSend = pickedIds.length > 0 && selectedIds.length > 0 && !sending;

  const filteredFriends = friends.filter((f) => {
    const query = friendSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      f.name.toLowerCase().includes(query) ||
      f.email.toLowerCase().includes(query)
    );
  });

  const sendToFriends = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/share/to-friends`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaIds: pickedIds,
          friendIds: selectedIds,
        }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        setError(
          json?.error?.message ?? `HTTP error! status: ${response.status}`,
        );
        return;
      }
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } catch {
      setError(t("share.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  // ---- Media picker UI ----
  const renderPicker = () => {
    if (mediaLoading) {
      return (
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md bg-muted/40" />
          ))}
        </div>
      );
    }
    if (media.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <ImageIcon className="size-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            {t("share.noMedia")}
          </p>
        </div>
      );
    }
    return (
      <ScrollArea
        type="always"
        className="h-44 pr-1"
      >
        <div className="grid grid-cols-5 gap-1.5">
          {media.map((m) => {
            const isPicked = Boolean(picked[m.id]);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMedia(m.id)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md ring-1 transition [content-visibility:auto]",
                  isPicked
                    ? "ring-2 ring-primary"
                    : "ring-border/50 hover:ring-primary/50",
                )}
                aria-label={m.title ?? m.id}
              >
                {m.mediaType === "video" ? (
                  <span className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                    <Film className="size-4" />
                  </span>
                ) : (
                  <img
                    src={m.thumbnailUrl}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                )}
                {isPicked && (
                  <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-border/40 p-2"
          >
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Media picker */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("share.pickMedia")}
          </p>
          <Combobox
            value={category}
            onChange={(v: string) => {
              if (v === "gallery" || v === "favorites") setCategory(v);
            }}
            options={[
              { value: "gallery", label: t("sidebar.gallery") },
              { value: "favorites", label: t("favorites.title") },
            ]}
            searchPlaceholder={t("share.categorySearch")}
            emptyText={t("share.categoryEmpty")}
            className="h-7"
          />
        </div>
        {renderPicker()}
        {pickedIds.length > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("share.pickedCount", { count: pickedIds.length })}
          </p>
        )}
      </div>

      <Separator />

      {/* Friend list */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("share.pickFriends")}
          </p>
          <div className="relative flex-1 max-w-[180px]">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              placeholder={t("share.searchFriends")}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>

        {friends.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Users className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("share.noFriends")}</p>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Search className="size-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {t("share.noFriendResults")}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-44 pr-1">
            <ul className="flex flex-col gap-2">
              {filteredFriends.map((friend) => {
                const isSelected = Boolean(selected[friend.id]);
                return (
                  <li key={friend.id}>
                    <button
                      type="button"
                      onClick={() => toggle(friend.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors",
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/40 hover:bg-muted/50",
                      )}
                    >
                      <Avatar size="sm">
                        {friend.avatar_url ? (
                          <AvatarImage
                            src={friend.avatar_url}
                            alt={friend.name}
                          />
                        ) : null}
                        <AvatarFallback>
                          {friend.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {friend.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {friend.email}
                        </p>
                      </div>
                      {isSelected && <Check className="size-4 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <Button
        size="sm"
        className="w-full"
        disabled={!canSend}
        onClick={sendToFriends}
      >
        {sending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <MorphIcon icon={sent ? CheckSquare2 : Send} size={14} />
        )}
        {sent
          ? t("share.invitesSent")
          : t("share.sendToFriends", { count: selectedIds.length })}
      </Button>
    </div>
  );
};
