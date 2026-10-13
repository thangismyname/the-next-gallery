import { FileMetadata, TransferProgress } from "@/types";
import { SIGNAL } from "@/services/signaling";
import {
  CHUNK_SIZE,
  DC_CONTROL,
  WebRTCPeer,
  decodeChunk,
  encodeChunk,
} from "@/services/webrtc";

// ==========================================================
// useFileTransfer — Chunked file transfer hook
// ==========================================================
// Phối hợp 2 transport theo protocol backend:
//   - WS signaling: transfer:metadata / accept / reject / progress / complete
//   - WebRTC DataChannel: binary chunks + ACK + file-end
// Sender chờ ACK từng chunk (backpressure) trước khi gửi chunk kế tiếp.
// ==========================================================

// Signaling surface cần thiết — duck-typed để dễ test
type SignalPayload = Record<string, unknown>;
type SignalHandler = (payload: SignalPayload) => void;
export interface TransferSignaling {
  send(type: string, payload: SignalPayload): void;
  on(type: string, handler: SignalHandler): () => void;
}

// Nguồn dữ liệu transfer — không phụ thuộc File để có thể stream từ
// Network (fetch body) hoặc Blob trong Phase 1.6. File thoả interface này,
// nhưng thật nhẹ RAM hơn khi stream trực tiếp.
export interface TransferSource {
  id: string;
  name: string;
  type: string;
  size: number;
  stream: () => ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>>;
}

const ACCEPT_TIMEOUT_MS = 60_000;
const ACK_TIMEOUT_MS = 30_000;

function waitForAccept(
  signaling: TransferSignaling,
  sessionId: string,
  senderId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Người nhận không chấp nhận trong 60s"));
    }, ACCEPT_TIMEOUT_MS);

    const offAccept = signaling.on(SIGNAL.TRANSFER_ACCEPT, (payload) => {
      const p = payload as { from?: string; sessionId?: string };
      if (p.from === senderId && p.sessionId === sessionId) {
        cleanup();
        resolve();
      }
    });

    const offReject = signaling.on(SIGNAL.TRANSFER_REJECT, (payload) => {
      const p = payload as { from?: string; sessionId?: string };
      if (p.from === senderId && p.sessionId === sessionId) {
        cleanup();
        reject(new Error("Người nhận từ chối"));
      }
    });

    function cleanup(): void {
      clearTimeout(timer);
      offAccept();
      offReject();
    }
  });
}

function waitForChunkAck(
  peer: WebRTCPeer,
  fileId: string,
  chunkIndex: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`ACK timeout tại chunk ${chunkIndex}`));
    }, ACK_TIMEOUT_MS);

    const offControl = peer.on("control", (raw) => {
      const ctrl = raw as { type?: string; fileId?: string; chunkIndex?: number };
      if (
        ctrl?.type === DC_CONTROL.ACK &&
        ctrl.fileId === fileId &&
        ctrl.chunkIndex === chunkIndex
      ) {
        cleanup();
        resolve();
      }
    });

    function cleanup(): void {
      clearTimeout(timer);
      offControl();
    }
  });
}

async function sendSingleFile(
  peer: WebRTCPeer,
  fileId: string,
  source: TransferSource,
  onChunkSent: (bytes: number) => void,
): Promise<void> {
  const reader = (await source.stream()).getReader();
  let chunkIndex = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      let offset = 0;
      while (offset < value.byteLength) {
        const part = value.subarray(offset, offset + CHUNK_SIZE);
        if (peer.dc?.readyState !== "open") {
          throw new Error("DataChannel đã đóng");
        }
        peer.sendBinary(encodeChunk(fileId, chunkIndex, part.slice().buffer));
        await waitForChunkAck(peer, fileId, chunkIndex);
        chunkIndex += 1;
        offset += CHUNK_SIZE;
        onChunkSent(part.byteLength);
      }
    }
  } finally {
    reader.releaseLock();
  }

  peer.sendControl({ type: DC_CONTROL.FILE_END, fileId });
}

export function useFileTransfer() {
  // ── SENDER ──
  async function sendFiles(
    args: {
      peerId: string;
      sessionId: string;
      peer: WebRTCPeer;
      signaling: TransferSignaling;
      files: TransferSource[];
    },
    onProgress: (p: TransferProgress) => void,
    onComplete: () => void,
  ): Promise<void> {
    const { peerId, sessionId, peer, signaling, files } = args;

    const metadata: FileMetadata[] = files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const startTime = performance.now();

    // 1. Announce files qua WebSocket signaling
    signaling.send(SIGNAL.TRANSFER_METADATA, {
      to: peerId,
      sessionId,
      files: metadata,
    });

    // 2. Chờ receiver accept
    await waitForAccept(signaling, sessionId, peerId);

    // 3. Stream từng file chunk-by-chunk với ACK backpressure
    let bytesTransferred = 0;
    let completedFiles = 0;
    let lastReported = -0.02;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadata[i];

      await sendSingleFile(peer, meta.id, file, (bytes) => {
        bytesTransferred += bytes;
        const fraction = totalBytes > 0 ? bytesTransferred / totalBytes : 1;
        if (fraction - lastReported >= 0.02 || i === files.length - 1) {
          lastReported = fraction;
          onProgress(buildProgress(sessionId, files, completedFiles, file.name, bytesTransferred, totalBytes, startTime));
        }
      });

      completedFiles += 1;
      onProgress(buildProgress(sessionId, files, completedFiles, file.name, bytesTransferred, totalBytes, startTime));
    }

    // 4. Hoàn tất qua WebSocket signaling
    signaling.send(SIGNAL.TRANSFER_COMPLETE, { sessionId, to: peerId });
    onProgress({
      sessionId,
      totalFiles: files.length,
      completedFiles: files.length,
      currentFile: "",
      bytesTransferred: totalBytes,
      totalBytes,
      speed: 0,
      eta: 0,
      status: "completed",
    });
    onComplete();
  }

  // ── RECEIVER ──
  function startReceiving(
    args: {
      senderId: string;
      sessionId: string;
      peer: WebRTCPeer;
      signaling: TransferSignaling;
    },
    onMetadata: (files: FileMetadata[]) => void,
    onFileReceived: (fileId: string, chunks: ArrayBuffer[]) => void,
    onComplete: () => void,
  ): () => void {
    const { senderId, sessionId, peer, signaling } = args;
    const chunksByFile = new Map<string, Map<number, ArrayBuffer>>();

    // 1. WS: metadata → preview cho UI
    const offMetadata = signaling.on(SIGNAL.TRANSFER_METADATA, (payload) => {
      const p = payload as { from?: string; sessionId?: string; files?: FileMetadata[] };
      if (p.from !== senderId || p.sessionId !== sessionId) return;
      if (Array.isArray(p.files)) onMetadata(p.files);
    });

    // 2. WS: complete → báo UI
    const offComplete = signaling.on(SIGNAL.TRANSFER_COMPLETE, (payload) => {
      const p = payload as { from?: string; sessionId?: string };
      if (p.from !== senderId || p.sessionId !== sessionId) return;
      cleanup();
      onComplete();
    });

    // 3. DC: nhận binary chunks → lưu + gửi ACK
    const offBinary = peer.on("binary", (raw) => {
      try {
        const { fileId, chunkIndex, chunk } = decodeChunk(raw as ArrayBuffer);
        let fileChunks = chunksByFile.get(fileId);
        if (!fileChunks) {
          fileChunks = new Map();
          chunksByFile.set(fileId, fileChunks);
        }
        fileChunks.set(chunkIndex, chunk);
        peer.sendControl({ type: DC_CONTROL.ACK, fileId, chunkIndex });
      } catch {
        // ignore malformed chunk
      }
    });

    // 4. DC: file-end → gom chunks + onFileReceived
    const offControl = peer.on("control", (raw) => {
      const ctrl = raw as { type?: string; fileId?: string };
      if (ctrl?.type !== DC_CONTROL.FILE_END || !ctrl.fileId) return;
      const fileChunks = chunksByFile.get(ctrl.fileId);
      if (!fileChunks) return;
      const ordered = Array.from(fileChunks.keys())
        .sort((a, b) => a - b)
        .map((index) => fileChunks.get(index) as ArrayBuffer);
      chunksByFile.delete(ctrl.fileId);
      onFileReceived(ctrl.fileId, ordered);
    });

    function cleanup(): void {
      offMetadata();
      offComplete();
      offBinary();
      offControl();
    }

    return cleanup;
  }

  return { sendFiles, startReceiving };
}

function buildProgress(
  sessionId: string,
  files: TransferSource[],
  completedFiles: number,
  currentFile: string,
  bytesTransferred: number,
  totalBytes: number,
  startTime: number,
): TransferProgress {
  const elapsed = (performance.now() - startTime) / 1000;
  const speed = elapsed > 0 ? bytesTransferred / elapsed : 0;
  const eta = speed > 0 ? (totalBytes - bytesTransferred) / speed : 0;
  return {
    sessionId,
    totalFiles: files.length,
    completedFiles,
    currentFile,
    bytesTransferred,
    totalBytes,
    speed,
    eta,
    status: "transferring",
  };
}