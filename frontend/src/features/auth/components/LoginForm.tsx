import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useAuth } from "./AuthContext";
import { OAuthButtons } from "./OAuthButtons";

type LoginFormProps = {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
};

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onSwitchToRegister,
}) => {
  const { t } = useTranslation();
  const { login, loginWithProvider } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(
    null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await login(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    onSuccess?.();
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    const { error } = await loginWithProvider(provider);
    setOauthLoading(null);
    if (error) {
      setError(t("auth.loginError"));
      return;
    }
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="login-email">{t("auth.email")}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
        />
      </div>

      {/* Field Password */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">{t("auth.password")}</Label>
          <Link
            to="/forgot-password"
            className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4"
          >
            {t("auth.forgotPassword")}
          </Link>
        </div>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <MorphIcon icon={showPassword ? EyeOff : Eye} size={16} />
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("auth.loggingIn") : t("auth.login")}
      </Button>

      <div className="relative py-2">
        <OAuthButtons />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="underline underline-offset-4 hover:text-primary"
        >
          {t("auth.signUp")}
        </button>
      </p>
    </form>
  );
};
