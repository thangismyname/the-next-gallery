import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminStats } from "@/types";

interface AdminStatsCardsProps {
  stats: AdminStats;
}

export function AdminStatsCards({ stats }: AdminStatsCardsProps) {
  const { t } = useTranslation();

  const items = [
    { label: t("admin.stats.totalUsers"), value: stats.totalUsers },
    { label: t("admin.stats.totalPhotos"), value: stats.totalPhotos },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {items.map((item) => (
        <Card key={item.label} className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
