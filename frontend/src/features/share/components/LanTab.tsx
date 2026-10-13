import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, Link2, WifiOff, Wifi } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Peer } from "@/types";
import { RtcState } from "@/hooks/useShare";
import { PeerCard } from "./PeerCard";

interface LanTabProps {
  peers: Peer[];
  connStates: Record<string, RtcState>;
  onConnect: (peerId: string) => void;
}

export const LanTab: React.FC<LanTabProps> = ({ peers, connStates, onConnect }) => {
  const { t } = useTranslation();
  const [manual, setManual] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  const submitManual = () => {
    if (!manual.trim()) return;
    setShowGuide(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Wifi className="size-3.5" />
          {t("share.lanTab")}
        </div>

        {peers.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-6 border-dashed border-border/60">
            <WifiOff className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("share.noPeers")}</p>
          </Card>
        ) : (
          <ScrollArea className="max-h-64 pr-1">
            <ul className="flex flex-col gap-2">
              {peers.map((peer) => (
                <li key={peer.userId}>
                  <PeerCard
                    peer={peer}
                    connectionState={connStates[peer.userId] ?? "idle"}
                    onConnect={() => onConnect(peer.userId)}
                  />
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Link2 className="size-3.5" />
          {t("share.manualConnect")}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t("share.manualPlaceholder")}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitManual();
            }}
          />
          <Button variant="outline" size="icon" onClick={submitManual} aria-label={t("share.manualConnect")}>
            <Link2 className="size-4" />
          </Button>
        </div>
      </div>

      {showGuide && (
        <Card className="flex flex-col gap-2 p-4 border-border/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Info className="size-3.5 text-primary" />
            {t("share.hotspotGuide.title")}
          </div>
          <ol className="list-decimal pl-5 text-xs text-muted-foreground">
            <li>{t("share.hotspotGuide.step1")}</li>
            <li>{t("share.hotspotGuide.step2")}</li>
            <li>{t("share.hotspotGuide.step3")}</li>
          </ol>
        </Card>
      )}
    </div>
  );
};