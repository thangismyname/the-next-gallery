// src/features/landing/components/LandingFooter.tsx
import { href, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  IconBrandGithub,
  IconBrandInstagram,
  IconBrandX,
} from "@tabler/icons-react";

const SOCIAL_LINKS = [
  { key: "github", href: "https://github.com", icon: IconBrandGithub },
  { key: "instagram", href: "https://instagram.com", icon: IconBrandInstagram },
  { key: "twitter", href: "https://twitter.com", icon: IconBrandX },
];

const FOOTER_LINKS = [
  {
    titleKey: "footer.sections.explore",
    links: [
      { key: "nav.gallery", to: "/gallery" },
      { key: "nav.about", to: "/about" },
      { key: "nav.contact", to: "/contact" },
    ],
  },
  {
    titleKey: "footer.sections.legal",
    links: [
      { key: "footer.terms", to: "/terms" },
      { key: "footer.privacy", to: "/privacy" },
    ],
  },
];

export function LandingFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-3">
            <Link
              to="/"
              className="font-mono text-sm uppercase tracking-[0.2em]"
            >
              {t("brand.name")}
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
            <div className="flex gap-3 pt-2">
              {SOCIAL_LINKS.map(({ key, href, icon: Icon }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={key}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="h-4 w-4" stroke={1.75} />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_LINKS.map((section) => (
            <div key={section.titleKey} className="space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t(section.titleKey)}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.key}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 font-mono text-xs uppercase tracking-widest text-muted-foreground md:flex-row">
          <span>
            © {year} {t("brand.name")}. {t("footer.rights")}
          </span>
          <span>{t("footer.madeWith")}</span>
        </div>
      </div>
    </footer>
  );
}
