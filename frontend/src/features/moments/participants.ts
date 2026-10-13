import { Moment } from "@/types";

export interface MomentParticipant {
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Người tham gia 1 moment: creator đứng đầu, rồi các user của slot đã filled
 * theo thứ tự slot — dedupe theo userId (creator ghim nhiều ảnh / self-fill
 * chỉ tính 1 lần). single → chỉ [creator].
 */
export function getMomentParticipants(moment: Moment): MomentParticipant[] {
  const creator: MomentParticipant = {
    userId: moment.userId,
    userName: moment.userName,
    userAvatarUrl: moment.userAvatarUrl ?? null,
  };
  if (moment.template === "single") return [creator];

  const seen = new Set<string>([moment.userId]);
  const out = [creator];
  for (const slot of moment.slots) {
    if (!slot.filled || !slot.userId || seen.has(slot.userId)) continue;
    seen.add(slot.userId);
    out.push({
      userId: slot.userId,
      userName: slot.userName,
      userAvatarUrl: slot.userAvatarUrl ?? null,
    });
  }
  return out;
}