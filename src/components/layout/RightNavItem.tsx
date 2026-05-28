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
  highlight?: "green";
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
  highlight,
  onClick
}: RightNavItemProps) {
  const isPrimary = variant === "primary";
  const isGreenHighlight = highlight === "green";

  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 transition-colors rounded-2xl shrink-0 w-[72px] cursor-pointer",
        isPrimary ? "h-[96px] md:h-[112px]" : "h-[72px] md:h-[80px]",
        isActive 
          ? isGreenHighlight 
            ? "bg-success-green text-white shadow-md border-success-green" 
            : "bg-white shadow-sm border border-neutral-gray-200"
          : isGreenHighlight 
            ? "bg-success-green-soft text-success-green hover:bg-success-green/20"
            : "hover:bg-neutral-gray-100",
        "active:scale-95" // Touch feedback
      )}
      onClick={onClick}
    >
      {/* Status Dot */}
      {status && (
        <div 
          className={cn(
            "absolute top-2 right-2 w-2 h-2 rounded-full",
            status === "critical" ? "bg-danger-red animate-pulse" : 
            status === "warning" ? "bg-accent-orange" : "bg-success-green"
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
        isActive 
          ? (isGreenHighlight ? "text-white" : "text-navy-900") 
          : (isGreenHighlight ? "text-success-green" : "text-text-muted")
      )}>
        {icon}
      </div>

      <span className={cn(
        "text-[10px] font-bold text-center px-1 leading-tight break-words max-w-full",
        isActive 
          ? (isGreenHighlight ? "text-white" : "text-navy-900") 
          : (isGreenHighlight ? "text-success-green" : "text-text-muted")
      )}>
        {label}
      </span>
    </Link>
  );
}
