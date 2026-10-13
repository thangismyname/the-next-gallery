import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { sendResetPasswordEmail } from "./mail.js";
import { dbPool } from "../config/db.js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const auth = betterAuth({
  database: dbPool,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({
        to: user.email,
        userName: user.name,
        resetUrl: url,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    },
    github: {
      clientId: requireEnv("GITHUB_CLIENT_ID"),
      clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
    },
  },
  secret: requireEnv("BETTER_AUTH_SECRET"),
  baseURL: requireEnv("BETTER_AUTH_URL"),
  trustedOrigins: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
  plugins: [admin()],
});
