// ==========================================================
// Transfer Service — Track active file transfers
// ==========================================================
//
// Tracks transfer state for each session:
// - Which files are being transferred
// - Progress per file
// - Overall transfer status
// ==========================================================

const activeTransfers = new Map(); // sessionId → TransferState

// Transfer state structure:
// {
//   sessionId: string,
//   senderId: string,
//   receiverId: string,
//   files: [{ id, name, size, type, checksum? }],
//   status: 'metadata' | 'transferring' | 'completed' | 'failed',
//   fileProgress: Map<fileId, { sent, total }>,
//   startedAt: number,
//   completedAt: number | null,
// }

export function startTransfer(sessionId, senderId, receiverId, files) {
  const transfer = {
    sessionId,
    senderId,
    receiverId,
    files,
    status: "metadata",
    fileProgress: new Map(),
    startedAt: Date.now(),
    completedAt: null,
  };

  for (const file of files) {
    transfer.fileProgress.set(file.id, { sent: 0, total: file.size });
  }

  activeTransfers.set(sessionId, transfer);
  return transfer;
}

export function getTransfer(sessionId) {
  return activeTransfers.get(sessionId) || null;
}

export function updateFileProgress(sessionId, fileId, bytesSent) {
  const transfer = activeTransfers.get(sessionId);
  if (!transfer) return null;

  transfer.status = "transferring";
  const fileProg = transfer.fileProgress.get(fileId);
  if (fileProg) {
    fileProg.sent = bytesSent;
  }
  return transfer;
}

export function completeTransfer(sessionId) {
  const transfer = activeTransfers.get(sessionId);
  if (!transfer) return null;

  transfer.status = "completed";
  transfer.completedAt = Date.now();

  // Don't remove immediately — keep for status queries
  // Remove after 10 minutes
  setTimeout(() => {
    activeTransfers.delete(sessionId);
  }, 10 * 60 * 1000);

  return transfer;
}

export function failTransfer(sessionId) {
  const transfer = activeTransfers.get(sessionId);
  if (!transfer) return null;

  transfer.status = "failed";
  transfer.completedAt = Date.now();
  return transfer;
}

export function removeTransfer(sessionId) {
  activeTransfers.delete(sessionId);
}

// Calculate overall progress
export function getTransferProgress(sessionId) {
  const transfer = activeTransfers.get(sessionId);
  if (!transfer) return null;

  let totalBytes = 0;
  let sentBytes = 0;

  for (const [, prog] of transfer.fileProgress) {
    totalBytes += prog.total;
    sentBytes += prog.sent;
  }

  const elapsed = (transfer.completedAt || Date.now()) - transfer.startedAt;
  const speed = elapsed > 0 ? (sentBytes / elapsed) * 1000 : 0; // bytes/sec

  return {
    sessionId: transfer.sessionId,
    status: transfer.status,
    totalFiles: transfer.files.length,
    totalBytes,
    sentBytes,
    speed,
    elapsed,
  };
}

// Get all active transfers (for debugging)
export function getActiveTransfers() {
  return Array.from(activeTransfers.values()).map((t) => ({
    sessionId: t.sessionId,
    senderId: t.senderId,
    receiverId: t.receiverId,
    status: t.status,
    fileCount: t.files.length,
    startedAt: new Date(t.startedAt).toISOString(),
  }));
}
