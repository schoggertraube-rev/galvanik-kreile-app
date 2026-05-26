"use client";

import { LucideIcon } from "lucide-react";

interface UserTileProps {
  initials: string;
  icon: LucideIcon;
  onClick: () => void;
}

export function UserTile({ initials, icon: Icon, onClick }: UserTileProps) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-6 bg-white border border-kreile-border-strong hover:border-kreile-accent hover:bg-kreile-surface-soft rounded-[28px] shadow-kreile-card hover:shadow-kreile-soft transition-all duration-300 transform hover:-translate-y-2 cursor-pointer w-32 md:w-36 aspect-square group"
    >
      <div className="text-3xl md:text-4xl font-black text-kreile-navy tracking-tighter mb-4 group-hover:text-kreile-accent transition-colors">
        {initials}
      </div>
      <div className="bg-kreile-bg p-3 rounded-2xl text-kreile-muted group-hover:bg-kreile-accent-soft group-hover:text-kreile-gold-muted transition-colors">
        <Icon className="w-6 h-6" />
      </div>
    </button>
  );
}
