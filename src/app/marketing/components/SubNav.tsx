"use client";

import React from "react";
import { motion } from "framer-motion";

export const floatIn = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } }
};

export const TAB_NAMES = ["Studio", "Ideen", "Kampagnen", "Reichweite", "Kunden", "Wirkung"] as const;
export type TabName = (typeof TAB_NAMES)[number];

export function SubNav({ activeTab, onTabChange }: { activeTab: TabName; onTabChange: (t: TabName) => void }) {
  return (
    <div className="mk-subnav">
      {TAB_NAMES.map(name => (
        <button
          key={name}
          className={activeTab === name ? 'active' : ''}
          onClick={() => onTabChange(name)}
          style={{ position: 'relative' }}
        >
          {activeTab === name && (
            <motion.span
              layoutId="mk-glider"
              className="mk-glider"
              style={{ position: 'absolute', inset: 0, borderRadius: 999 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{name}</span>
        </button>
      ))}
    </div>
  );
}
