"use client";

import { ReactNode } from "react";

interface HomeKpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  status: "success" | "warning" | "danger" | "info" | "neutral";
  onClick?: () => void;
  progress?: number;
}

export function HomeKpiCard({ title, value, subtitle, status, onClick, progress }: HomeKpiCardProps) {
  const getStatusColors = () => {
    switch (status) {
      case "success": return "text-status-green bg-status-green/20";
      case "warning": return "text-status-orange bg-status-orange/20";
      case "danger": return "text-status-red bg-status-red/20";
      case "info": return "text-kreile-navy bg-kreile-navy/10";
      default: return "text-kreile-muted bg-kreile-border";
    }
  };

  const getProgressColor = () => {
    switch (status) {
      case "success": return "bg-status-green";
      case "warning": return "bg-status-orange";
      case "danger": return "bg-status-red";
      case "info": return "bg-kreile-navy";
      default: return "bg-kreile-muted";
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`relative flex flex-col p-5 bg-white rounded-2xl shadow-kreile-card border border-kreile-border hover:border-kreile-border-strong hover:shadow-kreile-soft transition-all duration-300 ${onClick ? "cursor-pointer active:scale-95 transform hover:-translate-y-1" : ""} overflow-hidden`}
    >
      <h3 className="text-[11px] font-bold text-kreile-muted uppercase tracking-wider mb-2">
        {title}
      </h3>
      
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-black text-kreile-navy tracking-tighter leading-none">
          {value}
        </span>
      </div>
      
      <p className="text-xs font-semibold text-kreile-muted mt-1">
        {subtitle}
      </p>

      {/* Progress Bar (optional) */}
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-kreile-surface-warm">
          <div 
            className={`h-full ${getProgressColor()}`} 
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
