"use client";

import Link from "next/link";

interface StationStatusButtonProps {
  name: string;
  path?: string;
  index: number;
  isActive: boolean;
  hasAlert: boolean;
  onClick?: () => void;
  title?: string;
}

export function StationStatusButton({
  name,
  path,
  index,
  isActive,
  hasAlert,
  onClick,
  title
}: StationStatusButtonProps) {
  const content = (
    <>
      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-black shrink-0 ${
        isActive 
          ? "bg-white text-navy-700" 
          : hasAlert
            ? "bg-danger-red text-white animate-pulse"
            : "bg-navy-900 text-navy-500"
      }`}>
        {hasAlert ? "!" : index + 1}
      </span>
      <span className="truncate">{name}</span>
    </>
  );

  const className = `
    relative px-5 py-2.5 rounded-xl text-base font-black tracking-wide transition-all duration-300 flex items-center gap-3 select-none
    ${isActive 
      ? hasAlert
        ? "text-white bg-danger-red shadow-[0_0_20px_rgba(220,38,38,0.4)] scale-105 z-10 border border-danger-red/50"
        : "text-white bg-navy-700 shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105 z-10 border border-navy-700/50" 
      : hasAlert
        ? "text-danger-red bg-accent-orange-soft border border-danger-red animate-pulse hover:bg-danger-red"
        : "text-text-muted hover:text-white hover:bg-navy-900"
    }
  `;

  if (path) {
    return (
      <Link
        href={path}
        title={title}
        onClick={onClick}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`${className} cursor-pointer`}
    >
      {content}
    </button>
  );
}
