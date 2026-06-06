"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, BarChart3 } from "lucide-react";

export type TileProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  href?: string;
  kpi?: string;
  status?: { label: string; variant: "action" | "ready" | "prep" | "default" };
  footer?: string;
  analyseLink?: { label: string; href?: string; onClick?: () => void };
  onClick?: () => void;
};

export function Tile({ title, description, icon, iconColor, href, kpi, status, footer, analyseLink, onClick }: TileProps) {
  const router = useRouter();
  const statusColors = {
    action: "bg-red-50 text-red-600 border-red-100",
    ready: "bg-emerald-50 text-emerald-600 border-emerald-100",
    prep: "bg-amber-50 text-amber-600 border-amber-100",
    default: "bg-neutral-gray-100 text-text-muted border-neutral-gray-200",
  };

  const inner = (
    <>
      <div className="absolute -right-2 -bottom-2 pointer-events-none opacity-[0.06] transform scale-[7] -rotate-12 origin-bottom-right">
        {icon}
      </div>

      <div className="relative z-10 flex items-start justify-end gap-3 min-h-[24px]">
        {kpi && (
          <span className="text-xl font-extrabold text-navy-900 tracking-tight">{kpi}</span>
        )}
        {status && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColors[status.variant]}`}>
            {status.label}
          </span>
        )}
      </div>
      <h3 className="relative z-10 text-lg font-extrabold text-navy-900 leading-snug">{title}</h3>
      <p className="relative z-10 text-[13px] text-text-muted leading-relaxed">{description}</p>
      <div className="relative z-10 flex items-center justify-between mt-auto pt-1 gap-3">
        <span className="text-xs font-bold text-accent-orange flex items-center gap-1 group-hover:gap-2 transition-all">
          {footer ?? "Öffnen"} <ChevronRight className="w-3.5 h-3.5" />
        </span>
        {analyseLink && (
          analyseLink.onClick ? (
            <button
              onClick={(e) => { e.stopPropagation(); analyseLink.onClick!(); }}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors border border-blue-100 shrink-0 z-10 relative"
            >
              <BarChart3 className="w-3 h-3" /> {analyseLink.label}
            </button>
          ) : (
            <Link
              href={analyseLink.href!}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors border border-blue-100 shrink-0 z-10 relative"
            >
              <BarChart3 className="w-3 h-3" /> {analyseLink.label}
            </Link>
          )
        )}
      </div>
    </>
  );

  const cls = "group relative overflow-hidden bg-white border border-neutral-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5 flex flex-col gap-3 min-h-[140px] cursor-pointer";

  if (href && analyseLink) {
    return (
      <div className={cls} onClick={(e) => { if (onClick) onClick(); else router.push(href); }}>
        <div className="absolute -right-2 -bottom-2 pointer-events-none opacity-[0.06] transform scale-[7] -rotate-12 origin-bottom-right">
          {icon}
        </div>

        <div className="relative z-10 flex items-start justify-end gap-3 min-h-[24px]">
          {kpi && (
            <span className="text-xl font-extrabold text-navy-900 tracking-tight">{kpi}</span>
          )}
          {status && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColors[status.variant]}`}>
              {status.label}
            </span>
          )}
        </div>
        <h3 className="relative z-10 text-lg font-extrabold text-navy-900 leading-snug">{title}</h3>
        <p className="relative z-10 text-[13px] text-text-muted leading-relaxed">{description}</p>
        <div className="relative z-10 flex items-center justify-between mt-auto pt-1 gap-3">
          <span className="text-xs font-bold text-accent-orange flex items-center gap-1 group-hover:gap-2 transition-all">
            {footer ?? "Öffnen"} <ChevronRight className="w-3.5 h-3.5" />
          </span>
          {analyseLink && (
            <button
              onClick={(e) => { e.stopPropagation(); if (analyseLink.onClick) analyseLink.onClick(); else if (analyseLink.href) router.push(analyseLink.href); }}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors border border-blue-100 shrink-0 z-10 relative"
            >
              <BarChart3 className="w-3 h-3" /> {analyseLink.label}
            </button>
          )}
        </div>
      </div>
    );
  }
  if (href) {
    return <Link href={href} className={cls} onClick={onClick}>{inner}</Link>;
  }
  return <div className={cls} onClick={onClick}>{inner}</div>;
}
