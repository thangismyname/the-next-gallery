import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Moment } from "@/types";
import { MomentSlide } from "./MomentSlide";

type Props = {
  moments: Moment[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onDelete: (moment: Moment) => void;
  onLeave?: (moment: Moment) => void;
  onToggleReaction: (moment: Moment, emoji: string) => void;
  onNew: () => void;
};

const MD_QUERY = "(min-width: 768px)";
// Đủ rộng cho 3 card (384px mỗi card + gap): 3×384 + 2×20 + p-6(p-4) ≈ < 1400.
const XL_QUERY = "(min-width: 1400px)";

/**
 * Feed DẠNG VUỐT (vertical snap pager — kiểu stories), card bo cong 2xl:
 * - MOBILE (< md): mỗi lần vuốt = 1 card (PORTRAIT) full màn hình.
 * - DESKTOP (≥ md): mỗi lần vuốt = 1 HÀNG 2 card nằm NGANG cạnh nhau.
 * - DESKTOP RỘNG (≥ xl): mỗi hàng 3 card nếu màn hình đủ chỗ.
 * Mũi tên ↑/↓ điều hướng giữa các hàng (row).
 */
export const MomentFeed: React.FC<Props> = ({
  moments,
  isPending,
  isError,
  onRetry,
  onDelete,
  onLeave,
  onToggleReaction,
  onNew,
}) => {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const isMulti = useMediaQuery(MD_QUERY);
  const isXl = useMediaQuery(XL_QUERY);
  // Số card mỗi hàng: 1 (mobile) / 2 (desktop) / 3 (màn hình rộng đủ chỗ).
  const perRow = isMulti ? (isXl ? 3 : 2) : 1;

  // Nhóm moments thành từng hàng: mỗi hàng = 1 lần vuốt (snap 1 row).
  const rows = useMemo(() => {
    if (moments.length === 0) return [];
    const out: Array<{ moment: Moment; index: number }[]> = [];
    for (let i = 0; i < moments.length; i += perRow) {
      out.push(
        moments
          .slice(i, i + perRow)
          .map((m, offset) => ({ moment: m, index: i + offset })),
      );
    }
    return out;
  }, [moments, perRow]);

  const goTo = useCallback(
    (index: number) => {
      const el = scrollerRef.current;
      if (!el || index < 0 || index >= rows.length) return;
      el.children[index]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [rows.length],
  );

  // Phím tắt: ↑/↓/PageUp/PageDown/Space → chuyển giữa các hàng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = scrollerRef.current;
      if (!el || rows.length === 0) return;
      const current = Math.round(el.scrollTop / el.clientHeight);
      let next: number | null = null;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        next = Math.min(current + 1, rows.length - 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        next = Math.max(current - 1, 0);
      }
      if (next !== null && next !== current) {
        e.preventDefault();
        goTo(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length, goTo]);

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center gap-6 p-6">
        <div className="w-72">
          <Skeleton className="aspect-4/5 w-full rounded-2xl bg-muted/40" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
        <p className="text-sm">{t("moments.loadFailed")}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("moments.retry")}
        </Button>
      </div>
    );
  }

  if (moments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
        <span className="grid size-12 place-items-center rounded-full bg-muted/60">
          <Camera className="size-6 text-muted-foreground/50" />
        </span>
        <div className="space-y-1">
          <p className="text-sm">{t("moments.empty")}</p>
          <p className="text-xs text-muted-foreground/60">
            {t("moments.emptyHint")}
          </p>
        </div>
        <Button size="sm" onClick={onNew}>
          {t("moments.newMoment")}
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="flex h-full flex-col snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-none [&::-webkit-scrollbar]:hidden"
    >
      {rows.map((row, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="flex h-full shrink-0 snap-start snap-always items-center justify-center gap-5 p-4 md:p-6"
        >
          {row.map(({ moment }) => (
            <div
              key={moment.id}
              className="relative aspect-4/5 h-full w-full max-w-sm max-h-full self-center md:h-full md:w-96 md:max-w-none md:max-h-none"
            >
              <MomentSlide
                moment={moment}
                onDelete={() => onDelete(moment)}
                onLeave={onLeave ? () => onLeave(moment) : undefined}
                onToggleReaction={(emoji) => onToggleReaction(moment, emoji)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
