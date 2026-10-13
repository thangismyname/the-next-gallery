// src/features/landing/components/LandingHeader.tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Globe } from "lucide-react";

const NAV_LINKS = [
  { key: "nav.gallery", to: "/gallery" },
  { key: "nav.about", to: "/about" },
  { key: "nav.contact", to: "/contact" },
];

export function LandingHeader() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const toggleLang = () =>
    i18n.changeLanguage(i18n.language === "vi" ? "en" : "vi");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="font-mono text-sm uppercase tracking-[0.2em]">
          {t("brand.name")}
        </Link>

        <nav className="hidden gap-8 font-mono text-xs uppercase tracking-widest text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.key}
              to={link.to}
              className="transition-colors hover:text-foreground"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLang}
            aria-label={t("nav.toggleLanguage")}
          >
            <Globe className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={t("nav.toggleTheme")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Button
            asChild
            size="sm"
            className="rounded-none font-mono text-xs uppercase tracking-widest"
          >
            <Link to="/auth">{t("nav.login")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
