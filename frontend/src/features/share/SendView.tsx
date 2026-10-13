// features/share/SendView.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useShareContext } from "./ShareProvider";
import { TransferSource } from "@/hooks/useFileTransfer";
import { QRTab } from "./components/QRTab";
import { LanTab } from "./components/LanTab";
import { RoomCodeInput } from "./components/RoomCodeInput";
import { cn } from "@/lib/utils";
import { ArrowLeft, FileImage, FileVideo, Loader2, Plus, Send, Wifi, X } from "lucide-react";

interface LocalFileEntry {
  id: string;
  file: File;
  previewUrl?: string;
}

let localIdCounter = 0;

function buildSource(entry: LocalFileEntry): TransferSource {
  return {
    id: entry.id,
    name: entry.file.name,
    type: entry.file.type || "application/octet-stream",
    size: entry.file.size,
    stream: () => entry.file.stream(),
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SendView: React.FC = () => {
  const { t } = useTranslation();
  const share = useShareContext();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<LocalFileEntry[]>([]);
  const createdSessionRef = useRef(false);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const sources = useMemo(() => files.map(buildSource), [files]);

  // Tạo phòng khi có file đầu tiên được chọn
  const hasFiles = files.length > 0;
  useEffect(() => {
    if (hasFiles && !createdSessionRef.current) {
      createdSessionRef.current = true;
      share.leaveRoom();
      share.createSession([]);
    }
  }, [hasFiles, share]);

  // Rời phòng + thu hồi object URLs khi rời trang
  useEffect(() => {
    const createdRef = createdSessionRef;
    const urlsRef = previewUrlsRef;
    return () => {
      if (createdRef.current) share.leaveRoom();
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectedCount = useMemo(
    () =>
      Object.values(share.connStates).filter((state) => state === "connected")
        .length,
    [share.connStates],
  );

  const isReceiver = Boolean(share.session && !share.isHost);
  const hostName = share.peers[0]?.username;

  const joinRoom = (code: string) => {
    share.joinRoom(code);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: LocalFileEntry[] = Array.from(list).map((file) => {
      const entry: LocalFileEntry = {
        id: `local-${++localIdCounter}`,
        file,
      };
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        entry.previewUrl = url;
        previewUrlsRef.current.add(url);
      }
      return entry;
    });
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current.delete(target.previewUrl);
      }
      const next = prev.filter((f) => f.id !== id);
      if (next.length === 0) {
        createdSessionRef.current = false;
        share.leaveRoom();
      }
      return next;
    });
  };

  const sendToConnected = async () => {
    if (sources.length === 0 || connectedCount === 0) return;
    const targets = Object.entries(share.connStates)
      .filter(([, state]) => state === "connected")
      .map(([peerId]) => peerId);
    await Promise.all(
      targets.map((peerId) =>
        share.sendToPeer(peerId, sources).catch(() => undefined),
      ),
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {!share.session && (
        <Card className="flex flex-col gap-3 border-border/40 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Wifi className="size-4 shrink-0 text-muted-foreground" />
              <RoomCodeInput onJoin={joinRoom} className="flex-1" />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("share.joinDescription")}
            </p>
          </div>
        </Card>
      )}

      {isReceiver ? (
        <Card className="flex w-full flex-col items-center gap-4 border-border/40 p-6">
          <p className="rounded-md bg-muted px-4 py-2 font-mono text-xl font-semibold tracking-[0.4em] text-foreground">
            {share.session?.roomCode}
          </p>
          {hostName ? (
            <p className="text-sm text-muted-foreground">
              {t("share.waitingForSender", { name: hostName })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("share.waitingForSenderDefault")}
            </p>
          )}
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary/20 animate-pulse">
            <Wifi className="size-8 text-primary" />
          </div>
          <Button variant="outline" size="sm" onClick={share.leaveRoom} className="gap-1.5">
            <ArrowLeft className="size-3.5" />
            {t("share.leave")}
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                {t("send.title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("send.subtitle")}</p>
            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button onClick={() => inputRef.current?.click()}>
              <Plus className="size-4" />
              {t("send.pickFiles")}
            </Button>
          </div>

          {files.length === 0 ? (
            <Card
              className="flex cursor-pointer flex-col items-center gap-3 border-dashed border-border/60 p-12 text-center"
              onClick={() => inputRef.current?.click()}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <FileImage className="size-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("send.filesEmpty")}
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {files.map((entry) => {
                  const isVideo = entry.file.type.startsWith("video/");
                  return (
                    <div
                      key={entry.id}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border/40 bg-muted/30"
                    >
                      {entry.previewUrl ? (
                        <img
                          src={entry.previewUrl}
                          alt={entry.file.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isVideo ? (
                            <FileVideo className="size-8 text-muted-foreground" />
                          ) : (
                            <FileImage className="size-8 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-2">
                        <p className="truncate text-xs font-medium text-white">
                          {entry.file.name}
                        </p>
                        <p className="text-[10px] text-white/70">
                          {formatSize(entry.file.size)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(entry.id)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={t("send.remove")}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-sm text-muted-foreground">
                {t("send.readyToSend", { count: files.length })}
              </p>
            </>
          )}

          {hasFiles && !share.session && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("share.creating")}
            </div>
          )}

          {hasFiles && share.session && (
            <Card className="p-5">
              <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
                <div className="flex flex-1 items-start justify-center lg:justify-start">
                  <QRTab session={share.session} />
                </div>
                <Separator
                  orientation="vertical"
                  className="hidden h-auto self-stretch lg:block"
                />
                <div className="flex flex-1 flex-col gap-4">
                  <LanTab
                    peers={share.peers}
                    connStates={share.connStates}
                    onConnect={(peerId) => {
                      void share.connectToPeer(peerId).catch(() => undefined);
                    }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {t("send.totalSize", {
                        size: Math.round(
                          sources.reduce((sum, s) => sum + s.size, 0) / 1024 / 1024,
                        ),
                      })}
                    </p>
                    <Button
                      className={cn("gap-1.5")}
                      disabled={connectedCount === 0 || sources.length === 0}
                      onClick={sendToConnected}
                    >
                      <Send className="size-3.5" />
                      {t("share.sendToFriends", { count: connectedCount })}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
