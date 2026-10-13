// features/theme/components/ThemeToggle.tsx
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Moon, Sun } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    // Browser không hỗ trợ View Transitions API -> fallback đổi thẳng
    if (!document.startViewTransition || !buttonRef.current) {
      setTheme(nextTheme);
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    // Cả 2 chiều: vòng tròn màu mới toả ra từ nút
    const transition = document.startViewTransition(() => {
      setTheme(nextTheme);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 420,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          variant="ghost"
          size="icon"
          className={cn("hidden sm:inline-flex", className)}
          onClick={handleToggle}
          aria-label={t("header.toggleTheme", "Toggle theme")}
        >
          <MorphIcon icon={theme === "dark" ? Moon : Sun} size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("header.toggleTheme", "Toggle theme")}</TooltipContent>
    </Tooltip>
  );
}