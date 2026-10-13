import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/features/auth/components/AuthContext";

export function Hero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleCtaClick = () => {
    if (isAuthenticated) {
      navigate("/gallery");
    } else {
      navigate("/auth", { state: { from: "/gallery" } });
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 pb-10 md:pt-24">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
        {t("hero.eyebrow")}
      </p>
      <h1 className="mt-6 font-heading text-[13vw] leading-[0.9] tracking-tight md:text-[7.5rem]">
        {t("hero.titleLine1")}
        <br />
        {t("hero.titleLine2")}
      </h1>
      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_auto_auto] md:items-end">
        <p className="max-w-md font-sans text-sm text-muted-foreground">
          {t("hero.subcopy")}
        </p>
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {t("hero.stack")}
        </div>
        <Button
          onClick={handleCtaClick}
          className="group rounded-none font-mono text-xs uppercase tracking-widest"
        >
          {t("hero.cta")}
          <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </section>
  );
}
