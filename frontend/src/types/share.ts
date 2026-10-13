import type { MediaPreview } from "./media";

export interface ShareSession {
  id: string;
  roomCode: string;
  hostUser: { id: string; name: string; avatarUrl?: string };
  mediaIds: string[];
  mediaPreviews: MediaPreview[];
  status: "active" | "completed" | "expired" | "cancelled";
  transferMode: "webrtc" | "relay" | "lan";
  createdAt: string;
  expiresAt: string;
}

export interface ShareInvite {
  sessionId: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  mediaCount: number;
  expiresAt: number;
}

export interface ShareRoomInfo {
  roomId: string;
  roomCode: string;
  sessionId: string | null;
  expiresAt: number;
}

export interface Peer {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  connectionType: "lan" | "internet";
  isOnline: boolean;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  checksum?: string;
}

export interface TransferProgress {
  sessionId: string;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  bytesTransferred: number;
  totalBytes: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  status: "preparing" | "transferring" | "completed" | "failed" | "cancelled";
}

export interface ShareNotification {
  id: string;
  sender: { id: string; name: string; avatarUrl?: string };
  mediaCount: number;
  totalSize: number; // bytes
  roomCode: string;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
}