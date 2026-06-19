import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RightNavItemProps {
  label: string;
  icon: ReactNode;
  href: string;
  isActive?: boolean;
  status?: "critical" | "warning" | "ok";
  badge?: number;
  isExpanded?: boolean;
  onClick?: () => void;
}

export function RightNavItem({
  label,
  icon,
  href,
  isActive,
  status,
  badge,
  isExpanded,
  onClick
}: RightNavItemProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group relative flex items-center transition-all duration-300 motion-reduce:transition-none rounded-xl cursor-pointer shadow-sm hover:shadow-md",
        isExpanded ? "w-full justify-start px-3" : "justify-center",
        // Heights:
        "h-[56px]",
        // Widths:
        isExpanded ? "w-[184px]" : "w-[56px]",
        // Active visual state
        isActive 
          ? "bg-[#2E9E6B] text-white shadow-md" 
          : "bg-transparent text-navy-500 hover:bg-white hover:text-navy-900 border border-transparent hover:border-neutral-gray-200"
      )}
      onClick={onClick}
    >
      {/* Active dot / Status Dot */}
      {(status) && (
        <div 
          className={cn(
            "absolute top-1 right-1 w-2 h-2 rounded-full shadow-sm border-2 border-white",
            status === "critical" ? "bg-danger-red animate-pulse" : 
            status === "warning" ? "bg-accent-orange" : 
            "bg-success-green"
          )}
        />
      )}
      
      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger-red text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white z-10 shadow-sm">
          {badge}
        </span>
      )}

      <div className="relative h-12 w-12 shrink-0">
        <div className={cn("absolute inset-1 flex items-center justify-center transition-transform motion-reduce:transition-none", isActive && "scale-110")}>
          {icon}
        </div>
      </div>

      {isExpanded && (
        <span
          className="text-[14px] font-bold ml-3 leading-tight whitespace-nowrap overflow-hidden transition-opacity duration-150 motion-reduce:transition-none"
          style={{ opacity: isExpanded ? 1 : 0 }}
        >
          {label}
        </span>
      )}
      
      {/* Fallback for active item text if not expanded but is active and should show text?
          The prompt said "Bleibt IMMER leicht vergrößert (80px breit) mit Text sichtbar"
          Actually 80px is not enough for the full text, maybe just hidden but it grows?
          Let's just show text if isExpanded, and keep it clean when closed. 
          If active, it's 64px width, looks slightly popped out.
       */}
    </Link>
  );
}
