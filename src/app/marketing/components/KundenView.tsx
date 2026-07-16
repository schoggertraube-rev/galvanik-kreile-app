"use client";

import React from "react";
import { motion } from "framer-motion";
import { floatIn } from "./SubNav";
import type { Segment } from "@/lib/marketing/marketingTypes";

export function KundenView({ segmente }: { segmente: Segment[] }) {
  return (
    <motion.div key="kunden" initial="hidden" animate="visible" exit="exit">
      <motion.div custom={0} variants={floatIn} className="mk-panel">
        <h3 className="font-serif">Kunden wecken</h3>
        <div className="pdesc">Gespeicherte Segmentdefinitionen. Eine belastbare Kundenmitgliedschaft und Einwilligungszählung ist noch nicht angebunden.</div>
        <div className="mk-segs">
          {segmente.map(s => (
            <div key={s.id} className="mk-seg">
              <div className="mk-seg-ring">
                <div className="mk-seg-inner">{s.emoji}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="mk-seg-name">{s.name}</div>
                <div className="mk-seg-desc">{s.kundenAnzahl === null ? 'Mitgliederzahl nicht verfügbar' : `${s.kundenAnzahl} Kunden`}</div>
              </div>
              <span className="mk-seg-badge">{s.weckbar === null ? 'Einwilligung unbekannt' : `${s.weckbar} ansprechbar`}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
