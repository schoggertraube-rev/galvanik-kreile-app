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
    <div className="bg-white rounded-3xl p-6 shadow-kreile-card border border-kreile-border h-full">
      <h2 className="text-lg font-black text-kreile-navy mb-6">
        Heute wichtig
      </h2>
      
      <div className="space-y-3">
        {items.map((item) => {
          
          const getStatusStyle = () => {
            switch (item.status) {
              case "danger": return "bg-status-red/10 text-status-red border-status-red/20";
              case "warning": return "bg-status-orange/10 text-status-orange border-status-orange/20";
              case "success": return "bg-status-green/10 text-status-green border-status-green/20";
              default: return "bg-kreile-surface-warm text-kreile-navy border-kreile-border";
            }
          };

          const content = (
            <>
              <div className={`p-2 rounded-xl border shrink-0 ${getStatusStyle()}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-kreile-navy truncate">{item.title}</h3>
                <p className="text-xs text-kreile-muted truncate">{item.description}</p>
              </div>
              <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-kreile-bg text-kreile-accent group-hover:bg-kreile-accent group-hover:text-white transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </>
          );

          if (item.linkTo) {
            return (
              <Link 
                key={item.id} 
                href={item.linkTo}
                className="group flex items-center gap-4 p-3 -mx-3 rounded-2xl hover:bg-kreile-surface-soft transition-colors cursor-pointer"
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
            <p className="text-sm text-kreile-muted font-medium">Keine besonderen Vorkommnisse.</p>
          </div>
        )}
      </div>
    </div>
  );
}
