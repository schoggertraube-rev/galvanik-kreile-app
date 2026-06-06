"use client";
import React from "react";

export function SectionHeader({ icon, iconBg, title, badge }: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 mt-10 mb-5 px-1">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <span className="text-base font-extrabold text-navy-900">{title}</span>
      {badge && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
          {badge}
        </span>
      )}
    </div>
  );
}
