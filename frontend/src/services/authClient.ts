import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { AUTH_BASE_URL } from "@/lib/config";

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;