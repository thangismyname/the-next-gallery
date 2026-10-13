import { useTranslation } from "react-i18next";

export function ClosingStatement() {
  const { t } = useTranslation();

  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <p className="max-w-6xl font-heading text-3xl leading-tight md:text-5xl">
          {t("closing.statement")}
        </p>
      </div>
    </section>
  );
}
