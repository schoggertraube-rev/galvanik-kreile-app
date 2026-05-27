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
      className="flex flex-col items-center justify-center p-6 bg-white border border-neutral-gray-300 hover:border-accent-orange hover:bg-bg-app-soft rounded-[28px] shadow-kreile-card hover:shadow-kreile-soft transition-all duration-300 transform hover:-translate-y-2 cursor-pointer w-32 md:w-36 aspect-square group"
    >
      <div className="text-3xl md:text-4xl font-black text-navy-900 tracking-tighter mb-4 group-hover:text-accent-orange transition-colors">
        {initials}
      </div>
      <div className="bg-bg-app p-3 rounded-2xl text-text-muted group-hover:bg-accent-orange-soft group-hover:text-gold-600 transition-colors">
        <Icon className="w-6 h-6" />
      </div>
    </button>
  );
}
