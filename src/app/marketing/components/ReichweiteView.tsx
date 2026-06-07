"use client";

import React from "react";
import { motion } from "framer-motion";
import { floatIn } from "./SubNav";
import type { FunnelDaten } from "@/lib/marketing/marketingTypes";

export function ReichweiteView({ funnel, funnelKey }: { funnel: FunnelDaten | null; funnelKey: number }) {
  if (!funnel) return null;
  return (
    <motion.div key="reichweite" initial="hidden" animate="visible" exit="exit">
      <motion.div custom={0} variants={floatIn} className="mk-panel">
        <h3 className="font-serif">Was dein Marketing wirklich bringt</h3>
        <div className="pdesc">End-to-End verfolgt: vom Post bis zum bezahlten Auftrag â€” {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}.</div>
        <div className="mk-fbars">
          {funnel.stufen.map((s, i) => (
            <div key={i} className="mk-fbar">
              <span className="mk-fbar-label">{s.label}</span>
              <div className="mk-fbar-track">
                <motion.div
                  className="mk-fbar-fill"
                  key={`${funnelKey}-${i}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${s.breite}%` }}
                  transition={{ duration: 1, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
                >
                  {s.wert.toLocaleString('de-DE')}
                </motion.div>
              </div>
              <span className="mk-fbar-val">{s.wert.toLocaleString('de-DE')}</span>
            </div>
          ))}
        </div>
        <div className="mk-roi-big mk-animated">
          <div>
            <div className="mk-roi-label">Umsatz aus Marketing</div>
            <div className="mk-roi-value">{funnel.umsatz.toLocaleString('de-DE')} €</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mk-roi-label">ROI</div>
            <div className="mk-roi-value">{funnel.roi.toFixed(1).replace('.', ',')}×</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
