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
      case "success": return "text-success-green bg-success-green/20";
      case "warning": return "text-accent-orange bg-accent-orange/20";
      case "danger": return "text-danger-red bg-danger-red/20";
      case "info": return "text-navy-900 bg-navy-900/10";
      default: return "text-text-muted bg-neutral-gray-100";
    }
  };

  const getProgressColor = () => {
    switch (status) {
      case "success": return "bg-success-green";
      case "warning": return "bg-accent-orange";
      case "danger": return "bg-danger-red";
      case "info": return "bg-navy-900";
      default: return "bg-text-muted";
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`relative flex flex-col p-5 bg-white rounded-2xl shadow-kreile-card border border-neutral-gray-100 hover:border-neutral-gray-300 hover:shadow-kreile-soft transition-all duration-300 ${onClick ? "cursor-pointer active:scale-95 transform hover:-translate-y-1" : ""} overflow-hidden`}
    >
      <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">
        {title}
      </h3>
      
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-black text-navy-900 tracking-tighter leading-none">
          {value}
        </span>
      </div>
      
      <p className="text-xs font-semibold text-text-muted mt-1">
        {subtitle}
      </p>

      {/* Progress Bar (optional) */}
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-bg-app-soft">
          <div 
            className={`h-full ${getProgressColor()}`} 
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
