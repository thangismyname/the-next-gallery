import { useEffect, useState } from "react";
import type { UserGrowthPoint, RoleDistribution } from "../types";

interface ChartData {
  growth: UserGrowthPoint[];
  roleDistribution: RoleDistribution[];
}

export function useAdminStats() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/admin/stats/charts`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("loadFailed");
        const json = await res.json();
        setData(json.data ?? json);
      } catch {
        setError("loadFailed");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { data, loading, error };
}