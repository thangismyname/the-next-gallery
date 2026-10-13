import React from "react";
import { useTranslation } from "react-i18next";
import { BellRing, LogIn, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShareInvite as ShareInviteType } from "@/types";

interface ShareInviteProps {
  invite: ShareInviteType;
  onView: () => void;
  onDismiss: () => void;
}

export const ShareInvite: React.FC<ShareInviteProps> = ({
  invite,
  onView,
  onDismiss,
}) => {
  const { t } = useTranslation();

  return (
    <Alert className="w-[calc(100vw-2rem)] max-w-sm gap-3 p-4 shadow-lg border-border/60">
      <div className="flex items-start gap-3">
        <Avatar size="lg">
          {invite.senderAvatar ? (
            <AvatarImage src={invite.senderAvatar} alt={invite.senderName} />
          ) : null}
          <AvatarFallback>
            {invite.senderName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <AlertTitle className="flex items-center gap-2">
            <BellRing className="size-4 shrink-0 text-primary" />
            {invite.senderName}
          </AlertTitle>
          <AlertDescription className="mt-0.5">
            {t("share.inviteBody", { count: invite.mediaCount })}
          </AlertDescription>
          <p className="mt-1.5">
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold tracking-[0.25em] text-foreground">
              {invite.roomCode}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" className="flex-1" onClick={onView}>
          <LogIn className="size-3.5" />
          {t("share.inviteView")}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label={t("selection.cancel")}>
          <X className="size-4" />
        </Button>
      </div>
    </Alert>
  );
};
