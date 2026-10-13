// ==========================================================
// WebRTC Manager — P2P connection + chunk framing
// ==========================================================
// - WebRTCPeer: wrap RTCPeerConnection + RTCDataChannel với
//   event emitter đơn giản cho orchestrator sử dụng.
// - Chunk framing: encodeChunk/decodeChunk cho binary wire
//   protocol [2B fileIdLen][fileId][4B chunkIndex][chunk bytes].
// File control message (ACK, file-end) đi qua DataChannel dạng JSON.
// ==========================================================

export const RTC_CONFIG_INTERNET: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
export const RTC_CONFIG_LAN: RTCConfiguration = { iceServers: [] };

export const CHUNK_SIZE = 16384; // 16KB
export const DC_CONTROL = {
  ACK: "ack",
  FILE_END: "file-end",
} as const;

const DATA_CHANNEL_LABEL = "file-transfer";
const FILE_ID_MAX_BYTES = 64;

type PeerEventHandler = (payload: unknown) => void;

export class WebRTCPeer {
  readonly peerId: string;
  readonly pc: RTCPeerConnection;
  dc: RTCDataChannel | null = null;

  private listeners = new Map<string, Set<PeerEventHandler>>();

  constructor(peerId: string, config: RTCConfiguration = RTC_CONFIG_INTERNET) {
    this.peerId = peerId;
    this.pc = new RTCPeerConnection(config);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit("ice-candidate", event.candidate.toJSON());
      }
    };
    this.pc.onconnectionstatechange = () => {
      this.emit("connection-state", this.getConnectionState());
    };
    this.pc.ondatachannel = (event) => {
      this.dc = event.channel;
      this.wireDataChannel();
    };
  }

  // Offerer-side: create the DataChannel (gọi trước khi createOffer)
  createDataChannel(): RTCDataChannel {
    const dc = this.pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
    this.dc = dc;
    this.wireDataChannel();
    return dc;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    return this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  sendBinary(data: ArrayBuffer): void {
    if (this.dc?.readyState === "open") {
      this.dc.send(data);
    }
  }

  sendControl(msg: Record<string, unknown>): void {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify(msg));
    }
  }

  on(event: string, handler: PeerEventHandler): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  close(): void {
    this.dc?.close();
    this.pc.close();
    this.listeners.clear();
  }

  private wireDataChannel(): void {
    const dc = this.dc;
    if (!dc) return;
    dc.binaryType = "arraybuffer";
    dc.onopen = () => this.emit("connected", {});
    dc.onclose = () => this.emit("disconnected", {});
    dc.onerror = () => this.emit("dc-error", {});
    dc.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          this.emit("control", JSON.parse(event.data));
        } catch {
          this.emit("control", event.data);
        }
      } else {
        this.emit("binary", event.data);
      }
    };
  }

  private emit(event: string, payload: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of Array.from(set)) {
      handler(payload);
    }
  }
}

export class WebRTCManager {
  private peers = new Map<string, WebRTCPeer>();

  createPeer(peerId: string, config?: RTCConfiguration): WebRTCPeer {
    const existing = this.peers.get(peerId);
    if (existing) return existing;
    const peer = new WebRTCPeer(peerId, config);
    this.peers.set(peerId, peer);
    return peer;
  }

  getPeer(peerId: string): WebRTCPeer | undefined {
    return this.peers.get(peerId);
  }

  closePeer(peerId: string): void {
    this.peers.get(peerId)?.close();
    this.peers.delete(peerId);
  }

  closeAll(): void {
    for (const peer of this.peers.values()) {
      peer.close();
    }
    this.peers.clear();
  }
}

// ---- Binary framing ----
// Layout: [2B fileIdLen (BE)][fileId utf8][4B chunkIndex (BE)][chunk bytes]

export function encodeChunk(fileId: string, chunkIndex: number, chunk: ArrayBuffer): ArrayBuffer {
  const fileIdBytes = new TextEncoder().encode(fileId);
  if (fileIdBytes.length > FILE_ID_MAX_BYTES || fileIdBytes.length > 65535) {
    throw new Error("fileId quá dài");
  }
  const total = 2 + fileIdBytes.length + 4 + chunk.byteLength;
  const buffer = new Uint8Array(total);
  const view = new DataView(buffer.buffer);
  view.setUint16(0, fileIdBytes.length, false);
  buffer.set(fileIdBytes, 2);
  view.setUint32(2 + fileIdBytes.length, chunkIndex, false);
  buffer.set(new Uint8Array(chunk), 2 + fileIdBytes.length + 4);
  return buffer.buffer;
}

export function decodeChunk(combined: ArrayBuffer): {
  fileId: string;
  chunkIndex: number;
  chunk: ArrayBuffer;
} {
  const view = new DataView(combined);
  const fileIdLen = view.getUint16(0, false);
  const fileId = new TextDecoder().decode(new Uint8Array(combined, 2, fileIdLen));
  const chunkIndex = view.getUint32(2 + fileIdLen, false);
  const chunkStart = 2 + fileIdLen + 4;
  const chunk = new Uint8Array(combined, chunkStart, combined.byteLength - chunkStart).slice().buffer;
  return { fileId, chunkIndex, chunk };
}