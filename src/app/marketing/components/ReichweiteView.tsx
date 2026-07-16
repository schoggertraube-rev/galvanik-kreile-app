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
        <h3 className="font-serif">Gespeicherte Marketing-Zuordnungen</h3>
        <div className="pdesc">Ausgeführte Aktionen, Touchpoints und explizite Attributionen aus dem gesamten gespeicherten Datenbestand.</div>
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
            <div className="mk-roi-label">Explizit attribuierter Umsatz</div>
            <div className="mk-roi-value">{funnel.umsatz.toLocaleString('de-DE')} €</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mk-roi-label">Planbudget</div>
            <div className="mk-roi-value">{funnel.plannedBudget === null ? 'nicht erfasst' : `${funnel.plannedBudget.toLocaleString('de-DE')} €`}</div>
          </div>
        </div>
        <div className="pdesc" style={{ marginTop: 8 }}>ROI nicht berechenbar: Tatsächliche Marketingausgaben sind noch nicht mit dem Kostenledger verknüpft.</div>
      </motion.div>
    </motion.div>
  );
}
