import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldCheck, Wifi } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useShareContext } from "./ShareProvider";
import { RoomCodeInput } from "./components/RoomCodeInput";
import { cn } from "@/lib/utils";

export const ShareView: React.FC = () => {
  const { t } = useTranslation();
  const { roomCode: paramCode } = useParams<{ roomCode: string }>();
  const share = useShareContext();

  const [code, setCode] = useState(paramCode?.toUpperCase() ?? "");

  useEffect(() => {
    if (paramCode) setCode(paramCode.toUpperCase());
  }, [paramCode]);

  const session = share.session;
  const isJoined = Boolean(session);
  const hostName = share.peers[0]?.username;

  const leave = () => {
    share.leaveRoom();
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wifi className="size-7" />
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {t("share.joinTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isJoined ? t("share.hint") : t("share.joinDescription")}
        </p>
      </div>

      {!isJoined ? (
        <Card className="w-full p-4 border-border/40">
          <RoomCodeInput key={code} initialValue={code} onJoin={(c) => share.joinRoom(c)} />
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            {t("share.hint")}
          </p>
        </Card>
      ) : (
        <Card className="flex w-full flex-col items-center gap-4 p-6 border-border/40">
          <p className="rounded-md bg-muted px-4 py-2 font-mono text-xl font-semibold tracking-[0.4em] text-foreground">
            {session?.roomCode}
          </p>

          {hostName ? (
            <p className="text-sm text-muted-foreground">
              {t("share.waitingForSender", { name: hostName })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("share.waitingForSenderDefault")}</p>
          )}

          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary/20",
              "animate-pulse",
            )}
          >
            <Wifi className="size-8 text-primary" />
          </div>

          <Button variant="outline" size="sm" onClick={leave} className="gap-1.5">
            <ArrowLeft className="size-3.5" />
            {t("share.leave")}
          </Button>
        </Card>
      )}
    </div>
  );
};