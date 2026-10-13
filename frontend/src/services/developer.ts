import { API_URL } from "@/lib/config";

export type DeveloperStatus = "none" | "pending" | "approved" | "rejected";

export interface DeveloperStatusResult {
  status: DeveloperStatus;
  message: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminDeveloperRequest {
  id: string;
  userId: string;
  status: DeveloperStatus;
  message: string | null;
  reviewedAt: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
}

export async function fetchDeveloperStatus(): Promise<DeveloperStatusResult> {
  const res = await fetch(`${API_URL}/developer/status`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as DeveloperStatusResult;
}

export async function requestDeveloper(
  message?: string,
): Promise<DeveloperStatusResult> {
  const response = await fetch(`${API_URL}/developer/request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message ?? null }),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const json = await response.json();
  return (json.data ?? json) as DeveloperStatusResult;
}

export async function fetchAdminDeveloperRequests(
  status?: DeveloperStatus,
): Promise<AdminDeveloperRequest[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`${API_URL}/admin/developer-requests${params}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const json = await response.json();
  return (json.data ?? json) as AdminDeveloperRequest[];
}

export async function reviewDeveloperRequest(
  id: string,
  approve: boolean,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/admin/developer-requests/${id}/review`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    },
  );
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
}
