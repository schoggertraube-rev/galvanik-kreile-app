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
        "group relative flex flex-col items-center justify-center gap-1.5 transition-all duration-300 rounded-2xl cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.08] hover:w-[88px] hover:z-20",
        // Base sizes
        isPrimary ? "h-[88px] w-[80px]" : "h-[76px] w-[76px]",
        // Active visual state
        isActive 
          ? "bg-kreile-green border border-kreile-green text-white shadow-md ring-4 ring-kreile-green/20" 
          : "bg-white border border-neutral-gray-200 hover:bg-white hover:border-neutral-gray-300",
        "active:scale-95" // Touch feedback
      )}
      onClick={onClick}
    >
      {/* Active dot / Status Dot */}
      {(status) && (
        <div 
          className={cn(
            "absolute top-2 right-2 w-2.5 h-2.5 rounded-full shadow-sm border-2 border-white",
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

      <div className={cn(
        "flex items-center justify-center rounded-xl p-2 transition-colors",
        isActive ? "text-white" : "text-navy-500 group-hover:text-navy-900"
      )}>
        {icon}
      </div>

      <span className={cn(
        "text-[10px] font-bold text-center px-1 leading-tight wrap-break-word max-w-full transition-colors",
        isActive ? "text-white" : "text-navy-700 group-hover:text-navy-900"
      )}>
        {label}
      </span>
    </Link>
  );
}
