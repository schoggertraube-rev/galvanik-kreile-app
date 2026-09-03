"use client";

import Link from "next/link";
import { ArrowLeft, LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: LucideIcon;
    variant?: "primary" | "outline";
    /** Sichtbar, aber nativ deaktiviert — z. B. wenn kein Command hinterlegt ist. */
    disabled?: boolean;
    /** Ehrliche Begründung, warum die Aktion nicht verfügbar ist. */
    unavailableReason?: string;
  };
}

export function PageHeader({ title, subtitle, backHref, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Zurück"
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-white border border-neutral-gray-100 flex items-center justify-center text-text-muted hover:text-navy-900 hover:border-neutral-gray-300 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-black text-navy-900 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-text-muted mt-0.5 font-medium">{subtitle}</p>
          )}
        </div>
      </div>

      {action && (
        <>
          {action.href && !action.disabled ? (
            <Link
              href={action.href}
              className={[
                "flex items-center gap-2 px-4 py-2.5 min-h-[48px] rounded-xl text-sm font-bold transition-all shrink-0",
                action.variant === "outline"
                  ? "bg-white border border-neutral-gray-100 text-navy-900 hover:bg-bg-app"
                  : "bg-navy-900 text-white hover:bg-navy-700 shadow-sm",
              ].join(" ")}
            >
              {action.icon && <action.icon className="w-4 h-4" />}
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.disabled ? undefined : action.onClick}
              disabled={action.disabled}
              title={action.disabled ? action.unavailableReason : undefined}
              aria-describedby={action.disabled && action.unavailableReason ? "page-header-action-unavailable" : undefined}
              className={[
                "flex items-center gap-2 px-4 py-2.5 min-h-[48px] rounded-xl text-sm font-bold transition-all shrink-0",
                action.variant === "outline"
                  ? "bg-white border border-neutral-gray-100 text-navy-900 hover:bg-bg-app"
                  : "bg-navy-900 text-white hover:bg-navy-700 shadow-sm",
                action.disabled ? "opacity-50 cursor-not-allowed hover:bg-navy-900" : "",
              ].join(" ")}
            >
              {action.icon && <action.icon className="w-4 h-4" />}
              {action.label}
            </button>
          )}
          {action.disabled && action.unavailableReason && (
            <span className="sr-only" id="page-header-action-unavailable">
              {action.unavailableReason}
            </span>
          )}
        </>
      )}
    </div>
  );
}
