import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { t, i18n } = useTranslation();
  const toggleLang = () =>
    i18n.changeLanguage(i18n.language === "vi" ? "en" : "vi");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("hidden sm:inline-flex", className)}
          onClick={toggleLang}
          aria-label={t("header.toggleLanguage")}
        >
          <Globe className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("header.toggleLanguage")}</TooltipContent>
    </Tooltip>
  );
}
