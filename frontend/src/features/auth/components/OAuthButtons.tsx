import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { authClient } from "@/services/authClient";
import { IconBrandGoogle, IconBrandGithub } from "@tabler/icons-react";

type Provider = "google" | "github";

const PROVIDERS: {
  id: Provider;
  label: string;
  Icon: React.FC<{ size?: number }>;
}[] = [
  { id: "google", label: "Google", Icon: IconBrandGoogle },
  { id: "github", label: "GitHub", Icon: IconBrandGithub },
];

export const OAuthButtons: React.FC = () => {
  const { t } = useTranslation();
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const handleOAuth = async (provider: Provider) => {
    try {
      setLoadingProvider(provider);
      await authClient.signIn.social({
        provider,
        callbackURL: "/", // đổi thành route bạn muốn redirect sau khi login
      });
    } catch (err) {
      console.error(`OAuth ${provider} failed`, err);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("auth.orContinueWith")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map(({ id, label, Icon }) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            disabled={loadingProvider !== null}
            onClick={() => handleOAuth(id)}
            className="w-full"
          >
            <Icon size={16} />
            <span className="ml-2">
              {loadingProvider === id ? t("auth.connecting") : label}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};
