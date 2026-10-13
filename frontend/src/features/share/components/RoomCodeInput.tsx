import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RoomCodeInputProps {
  onJoin: (code: string) => void;
  initialValue?: string;
  className?: string;
}

export const RoomCodeInput: React.FC<RoomCodeInputProps> = ({
  onJoin,
  initialValue = "",
  className,
}) => {
  const { t } = useTranslation();
  const [code, setCode] = useState(initialValue.toUpperCase());
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6 || submitting) return;
    setSubmitting(true);
    onJoin(clean);
    setTimeout(() => setSubmitting(false), 1500);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t("share.joinPlaceholder")}
          className="font-mono text-center text-lg tracking-[0.35em] uppercase"
          maxLength={6}
        />
        <Button onClick={submit} disabled={code.length !== 6 || submitting} className="gap-1.5">
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogIn className="size-4" />
          )}
          {t("share.join")}
        </Button>
      </div>
    </div>
  );
};
