import { useTranslation } from "react-i18next";
import { Code2, Check, X } from "lucide-react";
import { useAdminDeveloperRequests } from "@/hooks/useAdminDeveloperRequests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AdminDeveloperRequests() {
  const { t } = useTranslation();
  const { requests, pending, loading, review } = useAdminDeveloperRequests();

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-3">
        <Code2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t("admin.developer.title")}</h2>
        {pending.length > 0 && (
          <Badge variant="secondary" className="ml-1">
            {pending.length}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          {t("admin.loading")}
        </div>
      ) : requests.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          {t("admin.developer.empty")}
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {requests.map((req) => (
            <li
              key={req.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {req.userName || req.userEmail}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {req.userEmail}
                </p>
                {req.message && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    “{req.message}”
                  </p>
                )}
              </div>

              <Badge
                variant={
                  req.status === "approved"
                    ? "default"
                    : req.status === "rejected"
                      ? "destructive"
                      : "secondary"
                }
              >
                {t(`admin.developer.status.${req.status}`)}
              </Badge>

              {req.status === "pending" && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => review(req.id, true)}
                    className="gap-1"
                  >
                    <Check className="h-4 w-4" />
                    {t("admin.developer.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => review(req.id, false)}
                    className="gap-1"
                  >
                    <X className="h-4 w-4" />
                    {t("admin.developer.reject")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
