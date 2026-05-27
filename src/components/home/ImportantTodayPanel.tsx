"use client";

import { LucideIcon, ArrowRight } from "lucide-react";
import Link from "next/link";

export type ImportantItem = {
  id: string;
  icon: LucideIcon;
  status: "warning" | "danger" | "success" | "neutral";
  title: string;
  description: string;
  linkTo?: string;
};

interface ImportantTodayPanelProps {
  items: ImportantItem[];
}

export function ImportantTodayPanel({ items }: ImportantTodayPanelProps) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-kreile-card border border-neutral-gray-100 h-full">
      <h2 className="text-lg font-black text-navy-900 mb-6">
        Heute wichtig
      </h2>
      
      <div className="space-y-3">
        {items.map((item) => {
          
          const getStatusStyle = () => {
            switch (item.status) {
              case "danger": return "bg-danger-red/10 text-danger-red border-danger-red/20";
              case "warning": return "bg-accent-orange/10 text-accent-orange border-accent-orange/20";
              case "success": return "bg-success-green/10 text-success-green border-success-green/20";
              default: return "bg-bg-app-soft text-navy-900 border-neutral-gray-100";
            }
          };

          const content = (
            <>
              <div className={`p-2 rounded-xl border shrink-0 ${getStatusStyle()}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-navy-900 truncate">{item.title}</h3>
                <p className="text-xs text-text-muted truncate">{item.description}</p>
              </div>
              <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-bg-app text-accent-orange group-hover:bg-accent-orange group-hover:text-white transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </>
          );

          if (item.linkTo) {
            return (
              <Link 
                key={item.id} 
                href={item.linkTo}
                className="group flex items-center gap-4 p-3 -mx-3 rounded-2xl hover:bg-bg-app-soft transition-colors cursor-pointer"
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={item.id} className="flex items-center gap-4 p-3 -mx-3 rounded-2xl">
              {content}
            </div>
          );
        })}
        
        {items.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted font-medium">Keine besonderen Vorkommnisse.</p>
          </div>
        )}
      </div>
    </div>
  );
}
