"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { safeReturnTo } from "@/lib/navigation/safeReturnTo";

interface AppBackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fallbackHref: string;
  label?: string;
  useReturnTo?: boolean;
}

export function AppBackButton({
  fallbackHref,
  label = "Zurück",
  useReturnTo = true,
  className,
  onClick,
  ...props
}: AppBackButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleBack = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
      if (e.defaultPrevented) return;
    }

    if (useReturnTo) {
      const returnTo = searchParams.get("returnTo");
      if (returnTo) {
        router.push(safeReturnTo(returnTo, fallbackHref));
        return;
      }
    }

    router.push(fallbackHref);
  };

  return (
    <button
      onClick={handleBack}
      className={cn(
        "flex items-center gap-2 text-accent-orange hover:text-accent-orange/80 font-bold transition-colors group cursor-pointer",
        className
      )}
      {...props}
    >
      <div className="bg-accent-orange/10 p-2 rounded-full group-hover:bg-accent-orange/20 transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </div>
      <span>{label}</span>
    </button>
  );
}
