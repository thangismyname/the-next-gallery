import React, { createContext, useContext, useCallback } from "react";
import { authClient, useSession } from "@/services/authClient";

type AuthContextType = {
  isAuthenticated: boolean;
  isPending: boolean;
  user: ReturnType<typeof useSession>["data"] extends { user: infer U } | null
    ? U | null
    : null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ error?: string }>;
  loginWithProvider: (
    provider: "google" | "github",
  ) => Promise<{ error?: string | null }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { data: session, isPending } = useSession();

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await authClient.signIn.email({ email, password });
    return { error: error?.message };
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      return { error: error?.message };
    },
    [],
  );

  // Đưa vào trong Provider để nằm trong context value
  const loginWithProvider = useCallback(
    async (provider: "google" | "github") => {
      try {
        await authClient.signIn.social({
          provider,
          callbackURL: "/",
        });
        return { error: null };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await authClient.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        isPending,
        user: session?.user ?? null,
        login,
        register,
        loginWithProvider,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth phải được dùng bên trong AuthProvider");
  }
  return ctx;
};
