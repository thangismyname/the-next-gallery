// frontend/src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../services/authClient";

export const ProtectedRoute = () => {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Đang tải...</div>;
  if (!session) return <Navigate to="/auth" replace />;

  return <Outlet />;
};

export const AdminRoute = () => {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Đang tải...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (session.user.role !== "admin") return <Navigate to="/gallery" replace />;

  return <Outlet />;
};
