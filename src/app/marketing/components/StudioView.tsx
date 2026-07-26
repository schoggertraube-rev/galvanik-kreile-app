"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import Link from "next/link";
import { floatIn } from "./SubNav";
import type { TabName } from "./SubNav";
import type { AktionVorschlag, StoryIdee, WirkungMini } from "@/lib/marketing/marketingTypes";

function useCounter(target: number, divisor = 1, running = true) {
  const [val, setVal] = useState(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    if (!running) { setTimeout(() => setVal(0), 0); return; }
    let cur = 0;
    const steps = 40;
    const inc = target / steps;
    const tick = () => {
      cur += inc;
      if (cur >= target) { cur = target; setVal(cur); return; }
      setVal(cur);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, running]);
  const formatted = divisor > 1
    ? (val / divisor).toFixed(1).replace('.', ',')
    : Math.round(val).toLocaleString('de-DE');
  return formatted;
}

function AnimatedCounter({ wert, suffix, divisor, running }: WirkungMini & { running: boolean }) {
  const formatted = useCounter(wert ?? 0, divisor, running && wert !== null);
  return <>{wert === null ? 'nicht gemessen' : `${formatted}${suffix}`}</>;
}

export function StudioView({
  aktion, varianteIdx, onNextVar, onPrevVar, storyIdeen, wirkungMini, onStoryClick, onEntryClick, isVisible
}: {
  aktion: AktionVorschlag;
  varianteIdx: number;
  onNextVar: () => void;
  onPrevVar: () => void;
  storyIdeen: StoryIdee[];
  wirkungMini: WirkungMini[];
  onStoryClick: (s: StoryIdee) => void;
  onEntryClick: (tab: TabName) => void;
  isVisible: boolean;
}) {
  return (
    <motion.div key="studio" initial="hidden" animate="visible" exit="exit">
      {/* Composer Hero */}
      <motion.div custom={0} variants={floatIn} className="mk-composer">
        <div className="mk-preview">
          <div className="mk-pv-top">
            <div className="mk-pv-ring mk-animated">
              <div className="mk-pv-ring-inner">K</div>
            </div>
            <div className="mk-pv-name">
              galvanik_kreile
              <small>Entwurfsvorschau · nicht veröffentlicht</small>
            </div>
          </div>
          <div className="mk-pv-img">
            <div className="mk-pv-half before">
              <div className="mk-pv-icon">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>
              </div>
              <span className="mk-pv-label">Vorher</span>
            </div>
            <div className="mk-pv-half after mk-animated">
              <div className="mk-pv-icon">
                <svg viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.6 5.7 21l2.3-7.1-6-4.5h7.6z" /></svg>
              </div>
              <span className="mk-pv-label">Nachher</span>
              <div className="mk-pv-shine mk-animated" />
            </div>
          </div>
          <div className="mk-pv-caption">
            <div className="mk-pv-acts">
              <svg className="heart" viewBox="0 0 24 24" style={{ fill: '#F2643C', stroke: '#F2643C' }}>
                <path d="M12 21s-7-4.4-9.5-8.5C.9 9.7 2.3 6 5.5 6 7.5 6 9 7.2 12 10c3-2.8 4.5-4 6.5-4 3.2 0 4.6 3.7 3 6.5C19 16.6 12 21 12 21z" />
              </svg>
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              <svg viewBox="0 0 24 24"><path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14" /></svg>
            </div>
            <div className="mk-pv-txt">
              <b>galvanik_kreile</b> {aktion.caption}
            </div>
            <div className="mk-pv-tags">{aktion.hashtags}</div>
          </div>
        </div>

        <div className="mk-ctrl">
          <span className="mk-badge">Gespeicherter Marketing-Vorschlag</span>
          <h2 className="font-serif">{aktion.titel}</h2>
          <div className="why">{aktion.begruendung}</div>
          <div className="mk-meta">
            <span className="mk-mtag out">{aktion.erwarteterOutput}</span>
            <span className="mk-mtag eff">{aktion.aufwand}</span>
            <span className="mk-mtag cost">{aktion.kosten}</span>
          </div>
          <div className="mk-actions">
            <button className="mk-nav-var" onClick={onPrevVar}>
              <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <Link
              href="/marketing/aktion"
              className="mk-cta mk-animated"
              title={aktion.publishReason}
            >
              <Send size={18} />
              Zur Prüfung und Freigabe
            </Link>
            <button className="mk-nav-var" onClick={onNextVar}>
              <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="mk-var-dots">
            {aktion.varianten.map((_, i) => (
              <span key={i} className={i === varianteIdx ? 'active' : ''} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* 3 Schritte */}
      <motion.div custom={1} variants={floatIn} className="mk-steps">
        <div className="mk-step">
          <div className="mk-step-num">1</div>
          <div className="mk-step-text"><b>Vorschlag prüfen</b>gespeicherten Text kontrollieren</div>
        </div>
        <div className="mk-step-arrow"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></div>
        <div className="mk-step">
          <div className="mk-step-num">2</div>
          <div className="mk-step-text"><b>Freigabe erteilen</b>über die Aktionsliste</div>
        </div>
        <div className="mk-step-arrow"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></div>
        <div className="mk-step">
          <div className="mk-step-num">3</div>
          <div className="mk-step-text"><b>Veröffentlichung gesperrt</b>Asset-Workflow und Provider-Beleg fehlen</div>
        </div>
      </motion.div>

      {/* Story Ideen */}
      <motion.div custom={2} variants={floatIn}>
        <div className="mk-sec-label">Ideen für heute — antippen &amp; übernehmen</div>
        <div className="mk-stories">
          {storyIdeen.map(story => (
            <StoryRing key={story.id} story={story} onClick={() => onStoryClick(story)} />
          ))}
        </div>
      </motion.div>

      {/* Wirkung Mini */}
      <motion.div custom={3} variants={floatIn}>
        <div className="mk-sec-label">Explizit gespeicherte Wirkung — gesamter Datenbestand</div>
        <div className="mk-impact">
          {wirkungMini.map(w => (
            <div key={w.label} className="mk-imp">
              <div className="mk-imp-label">{w.label}</div>
              <div className="mk-imp-value">
                <AnimatedCounter {...w} running={isVisible} />
              </div>
              {w.coverage.missingCount > 0 && (
                <div className="pdesc">
                  {w.coverage.measuredCount}/{w.coverage.sourceCount} Quellen belegt
                </div>
              )}
              <div className="mk-spark">
                {w.sparkValues.map((v, i) => (
                  <span key={i} style={{ height: `${v}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Entry Tiles */}
      <motion.div custom={4} variants={floatIn}>
        <div className="mk-sec-label">Tiefer einsteigen &amp; Verknüpfungen</div>
        <div className="mk-entries">
          <div className="mk-entry" onClick={() => onEntryClick("Ideen")}>
            <div className="mk-entry-icon">
              <svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.3 1 2.5h6c0-1.2.2-1.7 1-2.5A6 6 0 0012 3z" /></svg>
            </div>
            <div><h3>Ideenpool</h3><p>Alle Vorschläge, sortierbar</p></div>
          </div>
          <div className="mk-entry" onClick={() => onEntryClick("Reichweite")}>
            <div className="mk-entry-icon">
              <svg viewBox="0 0 24 24"><path d="M3 3v18h18M7 14l3-3 3 2 5-6" /></svg>
            </div>
            <div><h3>Reichweite</h3><p>Post â†’ Anfrage â†’ Umsatz</p></div>
          </div>
          <div className="mk-entry" onClick={() => onEntryClick("Kunden")}>
            <div className="mk-entry-icon">
              <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
            </div>
            <div><h3>Kunden</h3><p>Segmente &amp; Reaktivierung</p></div>
          </div>
          <Link href="/buchhaltung" className="mk-entry">
            <div className="mk-entry-icon" style={{ background: "var(--bg-app-soft)", color: "var(--text-muted)" }}>
              <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
            <div><h3>Buchhaltung</h3><p>Marketingkosten &amp; ROI</p></div>
          </Link>
          <Link href="/kommunikation" className="mk-entry">
            <div className="mk-entry-icon" style={{ background: "var(--bg-app-soft)", color: "var(--text-muted)" }}>
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
            <div><h3>Kommunikation</h3><p>Kundenanfragen bearbeiten</p></div>
          </Link>
          <Link href="/performance" className="mk-entry">
            <div className="mk-entry-icon" style={{ background: "var(--bg-app-soft)", color: "var(--text-muted)" }}>
              <svg viewBox="0 0 24 24"><path d="M2 20h20M5 17l5-5 4 4 7-7" /></svg>
            </div>
            <div><h3>Performance</h3><p>Umfassende Analyse</p></div>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StoryRing({ story, onClick }: { story: StoryIdee; onClick: () => void }) {
  const iconMap: Record<string, React.ReactNode> = {
    Building2: <svg viewBox="0 0 24 24"><path d="M3 22h18M5 22V8l7-5 7 5v14M9 22v-6h6v6" /></svg>,
    Star: <svg viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.6 5.7 21l2.3-7.1-6-4.5h7.6z" /></svg>,
    Landmark: <svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 12h.01M15 12h.01M9 16h.01M15 16h.01" /></svg>,
    Lightbulb: <svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.3 1 2.5h6c0-1.2.2-1.7 1-2.5A6 6 0 0012 3z" /></svg>,
    Plus: <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>,
  };

  return (
    <motion.div
      className={`mk-story ${story.isAdd ? 'add' : ''}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className={`mk-story-ring ${story.isAdd ? '' : 'mk-animated'}`}>
        <div className="mk-story-inner">
          {iconMap[story.icon] || iconMap.Star}
        </div>
      </div>
      <span className="mk-story-label">{story.label}</span>
    </motion.div>
  );
}
