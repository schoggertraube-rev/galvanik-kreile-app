import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RightNavItemProps {
  label: string;
  icon: ReactNode;
  href: string;
  variant: "primary" | "normal";
  isActive?: boolean;
  status?: "critical" | "warning" | "ok";
  badge?: number;
  highlight?: "green"; // Kept for interface compatibility, but visual effect changed per instructions
  onClick?: () => void;
}

export function RightNavItem({
  label,
  icon,
  href,
  variant,
  isActive,
  status,
  badge,
  onClick
}: RightNavItemProps) {
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 transition-all duration-300 rounded-2xl cursor-pointer shadow-sm hover:scale-105",
        // Primary is large and protrudes slightly if active
        isPrimary ? "h-[96px] md:h-[112px]" : "h-[72px] md:h-[80px]",
        isActive && isPrimary ? "w-[96px] translate-x-3 z-10" : "w-[72px]",
        // Active visual state
        isActive 
          ? "bg-bg-app border border-neutral-gray-200" 
          : "bg-white border border-transparent hover:bg-neutral-gray-100",
        "active:scale-95" // Touch feedback
      )}
      onClick={onClick}
    >
      {/* Active dot / Status Dot */}
      {(status || isActive) && (
        <div 
          className={cn(
            "absolute top-2 right-2 w-2 h-2 rounded-full shadow-sm",
            status === "critical" ? "bg-danger-red animate-pulse" : 
            status === "warning" ? "bg-accent-orange" : 
            status === "ok" ? "bg-success-green" :
            isActive ? "bg-navy-900" : ""
          )}
        />
      )}
      
      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger-red text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white z-10 shadow-sm">
          {badge}
        </span>
      )}

      <div className={cn(
        "flex items-center justify-center rounded-xl p-2",
        isActive ? "text-navy-900" : "text-text-muted"
      )}>
        {icon}
      </div>

      <span className={cn(
        "text-[10px] font-bold text-center px-1 leading-tight break-words max-w-full",
        isActive ? "text-navy-900" : "text-text-muted"
      )}>
        {label}
      </span>
    </Link>
  );
}
