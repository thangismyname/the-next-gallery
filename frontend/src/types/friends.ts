export interface Friend {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  friendSince?: string | null;
}

export interface FriendRequest {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  requestedAt?: string | null;
}

export type FriendRequestResult =
  | "sent"
  | "already_friends"
  | "pending_inbound"
  | "pending_outbound";