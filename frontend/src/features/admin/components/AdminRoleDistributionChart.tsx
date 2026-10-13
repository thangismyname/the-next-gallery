import { useTranslation } from "react-i18next";
import { Pie, PieChart, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RoleDistribution } from "@/types";

interface AdminRoleDistributionChartProps {
  data: RoleDistribution[];
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))"];

const chartConfig = {
  count: { label: "Count" },
} satisfies ChartConfig;

export function AdminRoleDistributionChart({
  data,
}: AdminRoleDistributionChartProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {t("admin.chart.roleDistribution")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto h-64 w-full max-w-64"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie
              data={data}
              dataKey="count"
              nameKey="role"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={4}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
