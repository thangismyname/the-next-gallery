import { useTranslation } from "react-i18next";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAdminStats } from "@/hooks/useAdminStats";
import { AdminStatsCards } from "./components/AdminStatsCards";
import { AdminUserTable } from "./components/AdminUserTable";
import { AdminUserGrowthChart } from "./components/AdminUserGrowthChart";
import { AdminRoleDistributionChart } from "./components/AdminRoleDistributionChart";
import { AdminDeveloperRequests } from "./components/AdminDeveloperRequests";

export function AdminDashboard() {
  const { t } = useTranslation();
  const { users, stats, loading, error, toggleBan, changeRole, deleteUser } =
    useAdminUsers();
  const { data: chartData, loading: chartsLoading } = useAdminStats();

  if (loading) {
    return (
      <div className="p-6 text-muted-foreground">{t("admin.loading")}</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-destructive">{t(`admin.error.${error}`)}</div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{t("admin.title")}</h1>

      {stats && <AdminStatsCards stats={stats} />}

      <AdminDeveloperRequests />

      {!chartsLoading && chartData && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <AdminUserGrowthChart data={chartData.growth} />
          </div>
          <AdminRoleDistributionChart data={chartData.roleDistribution} />
        </div>
      )}

      <AdminUserTable
        users={users}
        onToggleBan={toggleBan}
        onChangeRole={changeRole}
        onDeleteUser={deleteUser}
      />
    </div>
  );
}
