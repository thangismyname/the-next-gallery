import React from "react";
import { Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { HomeView } from "@/features/home/HomeView";
import { NotFoundView } from "@/features/not-found/NotFoundView";
import { GalleryView } from "@/features/gallery/GalleryView";
import { FavoritesView } from "@/features/favorites/FavoritesView";
import { FriendsView } from "@/features/friends/FriendsView";
import { FriendInviteHandler } from "@/features/friends/components/FriendInviteHandler";
import { MomentsView } from "@/features/moments/MomentsView";
import { TrashView } from "@/features/trash/TrashView";
import { CaptureView } from "@/features/capture/CaptureView";
import { ShareView } from "@/features/share/ShareView";
import { SendView } from "@/features/share/SendView";
import LandingView from "@/features/landing/LandingView";
import { AdminRoute, ProtectedRoute } from "./ProtecedRoutes";
import AuthView from "@/features/auth/AuthView";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { ResetPasswordView } from "@/features/auth/ResetPasswordView";
import { ForgotPasswordView } from "@/features/auth/ForgotPasswordView";
import { AdminLayout } from "@/components/layout/AdminLayout";

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/landing" element={<LandingView />} />
      <Route path="/auth" element={<AuthView />} />
      <Route path="/forgot-password" element={<ForgotPasswordView />} />
      <Route path="/reset-password" element={<ResetPasswordView />} />

      <Route element={<MainLayout />}>
        <Route path="/" element={<HomeView />} />
        {/* Route cần đăng nhập */}
        <Route element={<ProtectedRoute />}>
          <Route path="/gallery" element={<GalleryView />} />
          <Route path="/favorites" element={<FavoritesView />} />
          <Route path="/friends" element={<FriendsView />} />
          <Route path="/friends/invite" element={<FriendInviteHandler />} />
          <Route path="/trash" element={<TrashView />} />
          <Route path="/capture" element={<CaptureView />} />
          <Route path="/share" element={<SendView />} />
          <Route path="/share/:roomCode" element={<ShareView />} />
        </Route>
      </Route>

      {/* Moments — fullscreen, không dùng MainLayout (vẫn cần đăng nhập) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/moments" element={<MomentsView />} />
      </Route>

      {/* Admin nằm ngoài MainLayout, dùng layout + guard riêng */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundView />} />
    </Routes>
  );
};
