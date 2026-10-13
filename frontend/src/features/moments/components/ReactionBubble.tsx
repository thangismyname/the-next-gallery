import { MomentRecentReaction } from "@/types";

type Props = {
  reaction: MomentRecentReaction;
  index: number;
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Bubble tròn NHỎ 2 mặt: mặt TRƯỚC = emoji, mặt SAU = avatar người react.
 * Tự lật vô hạn (CSS 3D flip). Stagger lệch pha bằng animation-delay ÂM
 * nên mỗi bubble lật ra mặt avatar ở thời điểm khác nhau trong mỗi vòng.
 * Size nhỏ hơn (size-[22px] ≈ 30% so với size-8) để nằm kế nút react
 * không bị chèn ép.
 */
export const ReactionBubble: React.FC<Props> = ({ reaction, index }) => {
  // Stagger NHỎ (index * 0.2, tối đa 0.8s) — các bubble lật gần như
  // CÙNG LÚC, chỉ nối tiếp nhẹ để đọc được list "ai đã tim".
  const stagger = Math.min(index * 0.2, 0.8);

  return (
    <div
      className="reaction-flip-3d relative size-5.5 shrink-0"
      style={{ "--flip-delay": `${-stagger}s` } as React.CSSProperties}
      title={reaction.userName}
    >
      <div
        className="reaction-flip-card"
        style={{ animationDelay: `${-stagger}s` }}
      >
        {/* Mặt trước — emoji */}
        <div className="reaction-face absolute inset-0 grid size-full place-items-center overflow-hidden rounded-full bg-black/55 text-[12px] leading-none text-white shadow ring-1 ring-black/10 backdrop-blur-sm dark:ring-white/20">
          {reaction.emoji ?? "👍"}
        </div>

        {/* Mặt sau — avatar (dùng img/fallback thuần để vừa size 22px) */}
        <div className="reaction-face reaction-face-back absolute inset-0 size-full overflow-hidden rounded-full bg-muted shadow ring-1 ring-black/10 dark:ring-white/20">
          {reaction.userAvatarUrl ? (
            <img
              src={reaction.userAvatarUrl}
              alt={reaction.userName}
              className="size-full object-cover"
            />
          ) : (
            <span className="grid size-full place-items-center bg-muted text-[9px] font-semibold text-muted-foreground">
              {getInitials(reaction.userName)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
