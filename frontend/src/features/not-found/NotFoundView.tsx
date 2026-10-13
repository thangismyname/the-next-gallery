import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const NotFoundView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4 text-center px-4">
      <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
        {t("notFound.title")}
      </h2>
      <p className="text-muted-foreground">{t("notFound.description")}</p>
      <Button asChild>
        <Link to="/landing">{t("notFound.backHome")}</Link>
      </Button>
    </div>
  );
};
