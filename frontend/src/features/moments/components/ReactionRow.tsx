import { MomentRecentReaction } from "@/types";
import { ReactionBubble } from "./ReactionBubble";

type Props = {
  reactions: MomentRecentReaction[];
};

/**
 * Hàng bubble reaction NHỎ, nằm BÊN PHẢI nút "thả reaction".
 * Thứ tự TRÁI → PHẢI = reaction MỚI → SỚM (bubble mới nhất kế bên nút react,
 * theo thứ tự created_at DESC từ backend; càng cũ càng đẩy sang phải).
 * Chồng lên nhau trái → phải bằng margin-left âm -ml-1.5. Không tự định vị —
 * component cha đặt vị trí & giới hạn chiều rộng (overflow-hidden để
 * không lố ra khỏi ảnh card).
 */
export const ReactionRow: React.FC<Props> = ({ reactions }) => {
  if (reactions.length === 0) return null;

  return (
    <div className="ml-1 flex min-w-0 items-center overflow-hidden">
      {reactions.slice(0, 4).map((reaction, index) => (
        <div
          key={reaction.userId}
          className={index > 0 ? "-ml-1.5" : undefined}
          style={{ zIndex: reactions.length - index }}
        >
          <ReactionBubble reaction={reaction} index={index} />
        </div>
      ))}
    </div>
  );
};