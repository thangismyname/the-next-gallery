import { useCallback, useEffect, useState } from "react";
import { authClient, useSession } from "@/services/authClient";
import type { AdminStats, AdminUser } from "../types";

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, statsRes] = await Promise.all([
        authClient.admin.listUsers({ query: { limit: 100 } }),
        fetch(`${import.meta.env.VITE_API_URL}/admin/stats`, {
          credentials: "include",
        }).then((r) => r.json()),
      ]);

      if (usersRes.error) throw new Error(usersRes.error.message);

      setUsers(usersRes.data.users as unknown as AdminUser[]);
      setStats(statsRes.data ?? statsRes);
    } catch {
      setError("loadFailed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleBan = useCallback(
    async (user: AdminUser) => {
      if (user.banned) {
        await authClient.admin.unbanUser({ userId: user.id });
      } else {
        await authClient.admin.banUser({
          userId: user.id,
          banReason: "policyViolation",
        });
      }
      await loadData();
    },
    [loadData]
  );

  const changeRole = useCallback(
    async (userId: string, role: string) => {
      await authClient.admin.setRole({ userId, role: role as "admin" | "user" });
      await loadData();
    },
    [loadData]
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      try {
        const res = await authClient.admin.removeUser({ userId });
        if (res.error) throw new Error(res.error.message);
        await loadData();
      } catch (e) {
        console.error("Failed to delete user", e);
        throw e;
      }
    },
    [loadData]
  );

  return {
    users,
    stats,
    loading,
    error,
    toggleBan,
    changeRole,
    deleteUser,
    currentUserId: session?.user?.id,
  };
}