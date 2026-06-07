"use client";

import React from "react";
import { motion } from "framer-motion";
import { floatIn } from "./SubNav";
import type { Kampagne } from "@/lib/marketing/marketingTypes";

export function KampagnenView({ kampagnen, onOpenAnalysis }: { kampagnen: Kampagne[]; onOpenAnalysis: (k: string) => void }) {
  return (
    <motion.div key="kampagnen" initial="hidden" animate="visible" exit="exit">
      <motion.div custom={0} variants={floatIn} className="mk-panel">
        <h3 className="font-serif">Laufende &amp; geplante Kampagnen</h3>
        <div className="pdesc">Mehrere Aktionen mit einem Ziel gebündelt â€” das Studio verteilt sie auf die besten Zeitfenster.</div>
        {kampagnen.map(k => (
          <div key={k.id} className="mk-camp cursor-pointer" onClick={() => onOpenAnalysis('Kampagnen')}>
            <span className="mk-camp-dot" style={{ background: k.statusColor }} />
            <div className="mk-camp-content">
              <h4>{k.titel}</h4>
              <div className="ct">{k.kanal}</div>
            </div>
            <div className="mk-camp-bar"><span style={{ width: `${k.fortschritt}%` }} /></div>
            <span className="mk-camp-result">{k.ergebnis}</span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
