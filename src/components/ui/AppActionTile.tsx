"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AppActionTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  contextChip?: string;
  isActive?: boolean;
}

export function AppActionTile({
  icon,
  title,
  description,
  contextChip,
  isActive,
  disabled,
  className,
  ...props
}: AppActionTileProps) {
  return (
    <button
      className={cn(
        "bg-white border rounded-2xl p-6 flex flex-col items-start text-left w-full cursor-pointer transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        isActive
          ? "border-navy-900 shadow-md ring-1 ring-navy-900"
          : "border-neutral-gray-200 enabled:hover:border-navy-900 enabled:hover:shadow-md",
        className
      )}
      disabled={disabled}
      {...props}
    >
      <div className="flex justify-between items-start w-full mb-4">
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
            isActive ? "bg-navy-900 text-white" : "bg-bg-app-soft text-navy-900"
          )}
        >
          {icon}
        </div>
        {contextChip && (
          <span className="bg-bg-app-soft text-text-muted text-[10px] font-black uppercase px-2 py-1 rounded">
            {contextChip}
          </span>
        )}
      </div>

      <h3 className="font-bold text-lg text-navy-900 mb-2">{title}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{description}</p>
    </button>
  );
}
