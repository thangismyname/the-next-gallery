import { useEffect } from "react";

interface ShortcutOptions {
  meta?: boolean; // Cmd (Mac) hoặc Ctrl (Win)
  key: string;
}

export function useKeyboardShortcut(
  { meta = true, key }: ShortcutOptions,
  callback: () => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const metaMatches = meta ? e.metaKey || e.ctrlKey : true;
      if (metaMatches && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [meta, key, callback]);
}