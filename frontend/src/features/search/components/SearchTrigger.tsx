import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SearchTriggerProps {
  onOpen: () => void;
}

export function SearchTrigger({ onOpen }: SearchTriggerProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Desktop/tablet: pill button với shortcut hint */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-transparent text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden font-mono uppercase tracking-widest md:inline">
              {t("header.search", "Search")}
            </span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("header.search", "Search")}</TooltipContent>
      </Tooltip>

      {/* Mobile: chỉ icon */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={onOpen}
            aria-label={t("header.search", "Search")}
          >
            <Search className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("header.search", "Search")}</TooltipContent>
      </Tooltip>
    </>
  );
}
