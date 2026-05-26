"use client";

import { Check, Clock, ArrowRight } from "lucide-react";

export type TimelineItem = {
  id: string;
  time: string;
  title: string;
  description: string;
  status: "done" | "current" | "pause" | "upcoming";
  actionText?: string;
  onAction?: () => void;
};

interface DayTimelineProps {
  items: TimelineItem[];
}

export function DayTimeline({ items }: DayTimelineProps) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-kreile-card border border-kreile-border h-full">
      <h2 className="text-lg font-black text-kreile-navy mb-8">
        Tagesablauf auf einen Blick
      </h2>
      
      <div className="relative">
        {/* Die durchgehende vertikale Linie */}
        <div className="absolute left-[39px] top-4 bottom-4 w-px bg-kreile-border" />
        
        <div className="space-y-6 relative">
          {items.map((item, index) => {
            const isDone = item.status === "done";
            const isCurrent = item.status === "current";
            const isPause = item.status === "pause";
            
            return (
              <div key={item.id} className={`flex items-start gap-5 transition-opacity ${item.status === "upcoming" ? "opacity-50" : "opacity-100"}`}>
                
                {/* Zeitstempel */}
                <div className={`w-14 text-right pt-1 font-mono text-xs ${isCurrent ? "font-bold text-kreile-navy" : "font-medium text-kreile-muted"}`}>
                  {item.time}
                </div>
                
                {/* Status Indicator */}
                <div className="relative z-10 flex flex-col items-center shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                    isDone ? "bg-status-green border-status-green text-white" :
                    isCurrent ? "bg-white border-kreile-accent text-kreile-accent" :
                    isPause ? "bg-kreile-sand border-kreile-sand text-kreile-gold-muted" :
                    "bg-kreile-bg border-kreile-border text-transparent"
                  }`}>
                    {isDone && <Check className="w-3.5 h-3.5" />}
                    {isCurrent && <Clock className="w-3.5 h-3.5" />}
                  </div>
                </div>
                
                {/* Inhalt */}
                <div className={`flex-1 pt-0.5 pb-2 ${index !== items.length - 1 ? "border-b border-transparent" : ""}`}>
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4 mb-1">
                    <h3 className={`font-bold text-sm ${isCurrent ? "text-kreile-accent" : "text-kreile-navy"}`}>
                      {item.title}
                    </h3>
                    {item.actionText && item.onAction && (
                      <button 
                        onClick={item.onAction}
                        className="text-[10px] font-bold text-kreile-accent uppercase hover:text-kreile-gold-muted transition-colors flex items-center gap-1"
                      >
                        [{item.actionText}]
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-kreile-muted leading-relaxed max-w-md">
                    {item.description}
                  </p>
                </div>
                
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
