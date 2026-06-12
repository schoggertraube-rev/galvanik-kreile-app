"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export type UrgencyType = "crit" | "soon" | "wait" | "ok";

export interface OrderWideCardProps {
  id: string;
  orderNumber: string;
  customerName: string;
  article: string;
  surface: string;
  surfaceKey?: "chrom" | "nickel" | "gold" | "kupfer" | "zink" | "offen";
  badgeText?: string;
  urgency: UrgencyType;
  dueValue: string;
  dueLabel: string;
  collapsed?: boolean;
  onClick: () => void;
  onAdvance?: (e: React.MouseEvent) => void;
}

export function OrderWideCard({
  id,
  orderNumber,
  customerName,
  article,
  surface,
  surfaceKey = "offen",
  badgeText,
  urgency,
  dueValue,
  dueLabel,
  collapsed = false,
  onClick,
  onAdvance
}: OrderWideCardProps) {
  // Map urgency to colors based on reference HTML
  let uClass = "u-ok";
  if (urgency === "crit") uClass = "u-crit";
  if (urgency === "soon") uClass = "u-soon";
  if (urgency === "wait") uClass = "u-wait";

  // Map surface key to dot class
  const sDotClass = `s-${surfaceKey}`;

  // Map badge style based on reference HTML
  let badgeClass = "bg-neutral-gray-100 text-text-muted";
  if (badgeText?.toLowerCase().includes("überfällig")) badgeClass = "b-ueber";
  else if (badgeText?.toLowerCase().includes("plan")) badgeClass = "b-plan";
  else if (badgeText?.toLowerCase().includes("material")) badgeClass = "b-material";
  else if (badgeText?.toLowerCase().includes("freigabe") || badgeText?.toLowerCase().includes("rückmeldung") || badgeText?.toLowerCase().includes("wartet")) badgeClass = "b-freigabe";
  else if (badgeText) badgeClass = "bg-neutral-gray-100 text-text-muted";

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .card-bar { width: 5px; }
        .u-crit .card-bar { background: #c0392b; }
        .u-soon .card-bar { background: #d4850a; }
        .u-ok .card-bar { background: #1e7e45; }
        .u-wait .card-bar { background: #2471a3; }

        .sdot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.12); display: inline-block; }
        .s-chrom { background: linear-gradient(135deg, #c0c0c0, #e8e8e8); }
        .s-nickel { background: linear-gradient(135deg, #b0a890, #d4c9a8); }
        .s-gold { background: linear-gradient(135deg, #d4a017, #f0d060); }
        .s-kupfer { background: linear-gradient(135deg, #b87333, #da9a5b); }
        .s-zink { background: linear-gradient(135deg, #8a9ea8, #b0c4ce); }
        .s-offen { background: #ccc; }

        .b-ueber { background: #fdf0ee; color: #c0392b; }
        .b-plan { background: #eef8f1; color: #1e7e45; }
        .b-material { background: #fef7ec; color: #d4850a; }
        .b-freigabe { background: #edf4fa; color: #2471a3; }

        .c-due-val { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; line-height: 1; }
        .u-crit .c-due-val { color: #c0392b; }
        .u-soon .c-due-val { color: #d4850a; }
        .u-ok .c-due-val { color: #1e7e45; }
        .u-wait .c-due-val { color: #2471a3; }

        .card-pulse.u-crit { animation: cpulse 3s ease-in-out infinite; }
        @keyframes cpulse {
          0%, 100% { border-color: #d8d0c4; }
          50% { border-color: rgba(192,57,43,0.3); }
        }
      `}} />
      <motion.div
        onClick={onClick}
        drag={onAdvance ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.5 }}
        onDragEnd={(e, info) => {
          if (onAdvance && info.offset.x > 80) {
            onAdvance(e as any);
          }
        }}
        className={`card-pulse ${uClass} grid grid-cols-[5px_1fr] bg-[#faf8f4] border-[1.5px] border-[#d8d0c4] rounded-[14px] overflow-hidden cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:bg-[#f5f2ec] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:-translate-y-px`}
      >
        <div className="card-bar h-full"></div>
        {collapsed ? (
           <div className="p-3 flex flex-col items-center justify-center h-full opacity-60">
             <span className="font-mono text-[11px] font-bold text-[#1a1a1a] writing-vertical-rl transform rotate-180 truncate h-20">{orderNumber}</span>
           </div>
        ) : (
          <div className="grid grid-cols-[minmax(130px,160px)_minmax(140px,200px)_1fr_minmax(140px,180px)_auto_minmax(80px,110px)_24px] items-center gap-3 p-3.5 lg:px-4 lg:py-3.5 max-[900px]:grid-cols-2 max-[900px]:gap-y-1.5 max-[900px]:gap-x-3 w-full overflow-hidden">

            <span className="font-mono text-[13px] font-bold text-[#1a1a1a]">{orderNumber}</span>
            <span className="text-[14px] font-semibold text-[#1a1a1a] min-w-0 break-words">{customerName}</span>
            <span className="text-[14px] text-[#5e5850] min-w-0 break-words max-[900px]:col-span-full">{article}</span>

            <span className="flex items-center gap-1.5 text-[12px] text-[#9e9689] font-medium min-w-0 break-words max-[900px]:col-span-full">
              <span className={`sdot ${sDotClass}`}></span> {surface}
            </span>

            <span className={`text-[10px] font-bold py-1 px-2 rounded-[5px] uppercase tracking-[0.3px] whitespace-nowrap text-center ${badgeText ? badgeClass : 'hidden'}`}>
              {badgeText}
            </span>

            <span className="text-right flex flex-col justify-center">
              <span className="c-due-val">{dueValue}</span>
              <span className="text-[10px] text-[#9e9689] uppercase tracking-[0.5px] mt-0.5">{dueLabel}</span>
            </span>

            {onAdvance ? (
              <span
                className="text-[#9e9689] text-[18px] max-[900px]:hidden hover:text-[#1a6b38] hover:scale-125 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvance(e);
                }}
              >
                <ChevronRight className="w-6 h-6" />
              </span>
            ) : (
              <span className="text-[#9e9689] text-[18px] max-[900px]:hidden group-hover:text-[#5e5850]">
                <ChevronRight className="w-5 h-5" />
              </span>
            )}
          </div>
        )}
      </motion.div>
    </>
  );
}
