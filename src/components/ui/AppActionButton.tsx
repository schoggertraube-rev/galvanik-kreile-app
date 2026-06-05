import React from "react";
import { Button } from "./button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppActionButtonVariant = "primary" | "secondary" | "danger" | "outline" | "ghost";

interface AppActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppActionButtonVariant;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export function AppActionButton({
  children,
  variant = "primary",
  isLoading = false,
  icon,
  className,
  disabled,
  ...props
}: AppActionButtonProps) {
  let variantClasses = "";

  switch (variant) {
    case "primary":
      // Green for Confirm/Next
      variantClasses = "bg-success-green text-white hover:bg-success-green/90 border-transparent shadow-sm";
      break;
    case "secondary":
      // Navy for neutral actions
      variantClasses = "bg-navy-900 text-white hover:bg-navy-800 border-transparent shadow-sm";
      break;
    case "danger":
      // Red for Cancel/Delete
      variantClasses = "bg-error-red text-white hover:bg-error-red/90 border-transparent shadow-sm";
      break;
    case "outline":
      variantClasses = "bg-white text-navy-900 border border-neutral-gray-300 hover:bg-neutral-gray-100";
      break;
    case "ghost":
      variantClasses = "bg-transparent text-navy-900 hover:bg-neutral-gray-100";
      break;
  }

  return (
    <Button
      className={cn("px-5 py-2.5 rounded-xl font-bold transition-all", variantClasses, className)}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!isLoading && icon && <span className="mr-2">{icon}</span>}
      {children}
    </Button>
  );
}
