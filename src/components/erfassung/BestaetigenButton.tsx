"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BestaetigenButtonProps {
  label: string;
  euroBetrag: number | null;
  dauerMinuten?: number;
  disabled?: boolean;
  disabledHinweis?: string;
  disabledHref?: string | null;
  onClick: () => void;
  loading?: boolean;
}

export function BestaetigenButton({
  label,
  euroBetrag,
  dauerMinuten,
  disabled,
  disabledHinweis,
  onClick,
  loading,
  disabledHref = "/settings",
}: BestaetigenButtonProps) {
  return (
    <div className="w-full mt-6">
      <Button
        onClick={onClick}
        disabled={disabled || loading}
        className="w-full min-h-[56px] bg-[#C2185B] hover:bg-[#A3154D] text-white font-bold rounded-2xl text-lg flex items-center justify-center transition-colors"
      >
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <>
            {label} — {dauerMinuten ? `${dauerMinuten} Min · ` : ''}{euroBetrag === null ? "Kosten nicht verfügbar" : euroBetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </>
        )}
      </Button>
      {disabled && disabledHinweis && (
        <p className="text-center text-danger-red text-sm font-semibold mt-2">
          {disabledHinweis}{disabledHref ? <> <a href={disabledHref} className="underline hover:text-danger-red/80">Einstellungen öffnen</a></> : null}
        </p>
      )}
    </div>
  );
}
