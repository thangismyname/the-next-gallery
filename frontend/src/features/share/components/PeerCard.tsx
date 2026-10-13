import React from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Peer } from "@/types";
import { RtcState } from "@/hooks/useShare";
import { Loader2 } from "lucide-react";

interface PeerCardProps {
  peer: Peer;
  connectionState: RtcState;
  onConnect?: () => void;
}

export const PeerCard: React.FC<PeerCardProps> = ({
  peer,
  connectionState,
  onConnect,
}) => {
  const { t } = useTranslation();
  const isConnecting = connectionState === "connecting";
  const isConnected = connectionState === "connected";
  const badgeText = peer.connectionType === "lan" ? t("share.lanBadge") : t("share.internetBadge");

  return (
    <Card
      data-slot="share-peer-card"
      className="flex items-center gap-3 p-3 border-border/40"
    >
      <Avatar size="lg">
        {peer.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt={peer.username} /> : null}
        <AvatarFallback>{peer.username.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{peer.username}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-[10px]">
            {badgeText}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`size-2 shrink-0 rounded-full ${peer.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
              />
            </TooltipTrigger>
            <TooltipContent side="top">
              {peer.isOnline ? t("share.online") : t("share.offline")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {!isConnected && (
        <Button
          variant="outline"
          size="sm"
          onClick={onConnect}
          disabled={isConnecting}
        >
          {isConnecting && <Loader2 className="size-3 animate-spin" />}
          {t("share.connect")}
        </Button>
      )}
    </Card>
  );
};