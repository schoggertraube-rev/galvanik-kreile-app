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
  };
}

export function PageHeader({ title, subtitle, backHref, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="w-9 h-9 rounded-xl bg-white border border-kreile-border flex items-center justify-center text-kreile-muted hover:text-kreile-navy hover:border-kreile-border-strong transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-black text-kreile-navy leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-kreile-muted mt-0.5 font-medium">{subtitle}</p>
          )}
        </div>
      </div>

      {action && (
        <>
          {action.href ? (
            <Link
              href={action.href}
              className={[
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0",
                action.variant === "outline"
                  ? "bg-white border border-kreile-border text-kreile-navy hover:bg-kreile-bg"
                  : "bg-kreile-navy text-white hover:bg-kreile-navy-soft shadow-sm",
              ].join(" ")}
            >
              {action.icon && <action.icon className="w-4 h-4" />}
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className={[
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0",
                action.variant === "outline"
                  ? "bg-white border border-kreile-border text-kreile-navy hover:bg-kreile-bg"
                  : "bg-kreile-navy text-white hover:bg-kreile-navy-soft shadow-sm",
              ].join(" ")}
            >
              {action.icon && <action.icon className="w-4 h-4" />}
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
