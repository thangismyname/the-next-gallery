import { useCallback, useEffect, useState } from "react";
import {
  type AdminDeveloperRequest,
  fetchAdminDeveloperRequests,
  reviewDeveloperRequest,
} from "@/services/developer";

export function useAdminDeveloperRequests() {
  const [requests, setRequests] = useState<AdminDeveloperRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminDeveloperRequests();
      setRequests(data);
    } catch {
      setError("loadFailed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, approve: boolean) => {
    await reviewDeveloperRequest(id, approve);
    await load();
  };

  return {
    requests,
    pending: requests.filter((r) => r.status === "pending"),
    loading,
    error,
    review,
    reload: load,
  };
}
