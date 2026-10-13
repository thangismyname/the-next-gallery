import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Code2, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useDeveloperMode } from "@/hooks/useDeveloperMode";

interface DeveloperModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeveloperModeDialog({
  open,
  onOpenChange,
}: DeveloperModeDialogProps) {
  const { t } = useTranslation();
  const { status, isDeveloper, devModeEnabled, request, toggle, refresh } =
    useDeveloperMode();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const canApply = status === "none" || status === "rejected";

  const handleApply = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await request(message);
      setMessage("");
    } catch {
      setError(t("developer.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = {
    none: (
      <Badge variant="secondary">{t("developer.status.none")}</Badge>
    ),
    pending: (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        {t("developer.status.pending")}
      </Badge>
    ),
    approved: (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        {t("developer.status.approved")}
      </Badge>
    ),
    rejected: (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        {t("developer.status.rejected")}
      </Badge>
    ),
  }[status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            {t("developer.title")}
          </DialogTitle>
          <DialogDescription>{t("developer.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {t("developer.currentStatus")}
            </span>
            {statusBadge}
          </div>

          {canApply && (
            <div className="space-y-2">
              {status === "rejected" && (
                <p className="text-sm text-destructive">
                  {t("developer.rejectedHint")}
                </p>
              )}
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("developer.messagePlaceholder")}
                rows={3}
                maxLength={1000}
              />
            </div>
          )}

          {status === "pending" && (
            <p className="text-sm text-muted-foreground">
              {t("developer.pendingHint")}
            </p>
          )}

          {isDeveloper && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">
                  {t("developer.toggleLabel")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("developer.toggleHint")}
                </p>
              </div>
              <Button
                size="sm"
                variant={devModeEnabled ? "default" : "outline"}
                onClick={() => toggle()}
              >
                {devModeEnabled
                  ? t("developer.toggleOn")
                  : t("developer.toggleOff")}
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("developer.close")}
          </Button>
          {canApply && (
            <Button onClick={handleApply} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("developer.apply")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
