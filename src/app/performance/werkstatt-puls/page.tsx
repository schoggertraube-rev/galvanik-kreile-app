"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, Clock, Target, AlertOctagon, ArrowRight, Zap, CheckCircle2, TrendingDown } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { AnalysisOverlay } from '@/components/ui/AnalysisOverlay';
import { useFeatureFlag } from '@/lib/analytics/useFeatureFlag';
import { AnalyticsDrillDrawer } from '@/components/analytics/AnalyticsDrillDrawer';
import type { PeriodType } from '@/lib/analytics/plainLanguage';

export default function WerkstattPulsDetail() {
  const [overlay, setOverlay] = useState<string | null>(null);
  const analyticsDrawerEnabled = useFeatureFlag('analyticsDrawer');
  const [drillKpi, setDrillKpi] = useState<string | null>(null);
  const [drillPeriod, setDrillPeriod] = useState<PeriodType>('monat');

  return (
    <PerformanceDetailLayout
      title="Werkstatt-Puls"
      subtitle="Durchsatz, Stationsauslastung, Termintreue und Wochenziel — die operative Herzfrequenz der Galvanik."
      icon={<Activity className="w-6 h-6" style={{ color: '#fff' }} />}
      accentColor="rgba(34,211,238,0.18)"
      pill={{ label: 'HANDLUNGSBEDARF', variant: 'yellow' }}
    >
      <div className="pd-grid">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Performance',href:'/performance'}, {label:'Werkstatt-puls'}]} />
        <BackButton label="Performance" href="/performance" />
      </div>
      

        {/* Termintreue */}
        <div className="pd-tile" onClick={() => { if (analyticsDrawerEnabled) { setDrillKpi('on_time_rate'); } else { setOverlay('termintreue'); } }} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--negbg)' }}>
              <Clock className="w-5 h-5" style={{ color: 'var(--neg)' }} />
            </div>
            <div className="pd-tile-name">Termintreue</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--neg)' }}>76 %</div>
          <div className="pd-tile-desc">▼ −9 Pkt. vs. Vorjahr · Tendenz fallend</div>
          <div className="pd-mini-bars">
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '85%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '82%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--warn)', height: '79%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--neg)', height: '76%' }} />
          </div>
          <div className="pd-mini-bar-labels">
            <span>KW19</span><span>KW20</span><span>KW21</span><span>KW22</span>
          </div>
          <div className="pd-tile-foot">Trend analysieren <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Durchlaufzeit je Station */}
        <div className="pd-tile" onClick={() => setOverlay('durchlaufzeit')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--warnbg)' }}>
              <TrendingDown className="w-5 h-5" style={{ color: 'var(--warn)' }} />
            </div>
            <div className="pd-tile-name">Durchlaufzeit je Station</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--warn)' }}>9,4 Tage</div>
          <div className="pd-tile-desc">▲ +1,2 Tage vs. Vorjahr</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Schleifen</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '94%', background: 'var(--neg)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--neg)' }}>2,8 T</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Politur</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '78%', background: 'var(--warn)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--warn)' }}>2,3 T</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Galvanik</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '62%', background: 'var(--pos)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--pos)' }}>1,9 T</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Vorbereitung</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '41%', background: 'var(--info)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--info)' }}>1,2 T</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">QK / Vers.</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '35%', background: 'var(--purple)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--purple)' }}>1,2 T</div>
            </div>
          </div>
          <div className="pd-tile-foot">Engpass analysieren <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Stationsauslastung → Warendurchlauf */}
        <Link href="/warendurchlauf" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
                <Activity className="w-5 h-5" style={{ color: 'var(--info)' }} />
              </div>
              <div className="pd-tile-name">Stationsauslastung</div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div className="pd-bar-row">
                <div className="pd-bar-label">Schleifen</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '94%', background: 'linear-gradient(90deg, var(--neg), #fb7185)' }} /></div>
                <div className="pd-bar-val" style={{ color: 'var(--neg)' }}>94%</div>
              </div>
              <div className="pd-bar-row">
                <div className="pd-bar-label">Politur</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '78%', background: 'linear-gradient(90deg, var(--warn), #fcd34d)' }} /></div>
                <div className="pd-bar-val" style={{ color: 'var(--warn)' }}>78%</div>
              </div>
              <div className="pd-bar-row">
                <div className="pd-bar-label">Galvanik</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '62%', background: 'linear-gradient(90deg, var(--pos), #6ee7b7)' }} /></div>
                <div className="pd-bar-val">62%</div>
              </div>
              <div className="pd-bar-row">
                <div className="pd-bar-label">Vorbereitung</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '41%', background: 'linear-gradient(90deg, var(--info), #93c5fd)' }} /></div>
                <div className="pd-bar-val">41%</div>
              </div>
            </div>
            <div className="pd-tile-foot">Zum Warendurchlauf <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Engpassstation */}
        <div className="pd-tile" onClick={() => setOverlay('engpass')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--negbg)' }}>
              <AlertOctagon className="w-5 h-5" style={{ color: 'var(--neg)' }} />
            </div>
            <div className="pd-tile-name">Engpassstation</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--neg)' }}>Schleifen</div>
          <div className="pd-tile-desc">94% Auslastung · 14 Aufträge im Stau · Maschinenkapazität erreicht</div>
          <div className="pd-heatmap" style={{ marginTop: 12 }}>
            {[95, 92, 94, 88, 96, 94, 90, 85, 93, 91].map((v, i) => (
              <div key={i} className="pd-heatmap-cell" style={{ background: v > 90 ? 'var(--neg)' : v > 80 ? 'var(--warn)' : 'var(--pos)', opacity: 0.6 + (v / 100) * 0.4 }} title={`Tag ${i + 1}: ${v}%`} />
            ))}
          </div>
          <div style={{ fontSize: 9, color: 'var(--ink3)', textAlign: 'center', marginTop: 4 }}>Heatmap: Auslastung letzte 10 Arbeitstage</div>
          <div className="pd-tile-foot">Maßnahmen ansehen <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Aufträge im Umlauf → /orders */}
        <Link href="/orders" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--purpbg)' }}>
                <Target className="w-5 h-5" style={{ color: 'var(--purple)' }} />
              </div>
              <div className="pd-tile-name">Aufträge im Umlauf</div>
            </div>
            <div className="pd-tile-val">112</div>
            <div className="pd-tile-desc">Aktive Aufträge in der Werkstatt · davon 8 mit Terminrisiko</div>
            <div className="pd-stack" style={{ marginTop: 12 }}>
              <div className="pd-stack-seg" style={{ width: '35%', background: 'var(--info)' }}>Vorbereitung</div>
              <div className="pd-stack-seg" style={{ width: '30%', background: 'var(--warn)' }}>Galvanik</div>
              <div className="pd-stack-seg" style={{ width: '20%', background: 'var(--pos)' }}>Politur</div>
              <div className="pd-stack-seg" style={{ width: '15%', background: 'var(--purple)' }}>QK</div>
            </div>
            <div className="pd-tile-foot">Zum Auftragsbuch <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Terminrisiko-Liste */}
        <div className="pd-tile" onClick={() => setOverlay('terminrisiko')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--negbg)' }}>
              <AlertOctagon className="w-5 h-5" style={{ color: 'var(--neg)' }} />
            </div>
            <div className="pd-tile-name">Terminrisiko-Liste</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--neg)' }}>8</div>
          <div className="pd-tile-desc">Aufträge mit akutem Terminrisiko · Gesamtwert 22.400 €</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { id: 'A-2026-0089', kunde: 'Museum Lenzburg', tage: -2 },
              { id: 'A-2026-0091', kunde: 'Autohaus Berger', tage: -1 },
              { id: 'A-2026-0094', kunde: 'Schlosserei Brunner', tage: 0 },
            ].map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '4px 0', borderBottom: '1px solid var(--bd)' }}>
                <span style={{ fontWeight: 600 }}>{a.id}</span>
                <span style={{ color: 'var(--ink2)' }}>{a.kunde}</span>
                <span style={{ color: a.tage < 0 ? 'var(--neg)' : 'var(--warn)', fontWeight: 700 }}>{a.tage < 0 ? `${a.tage} T` : 'Heute'}</span>
              </div>
            ))}
          </div>
          <div className="pd-tile-foot">Vollständige Liste <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Wochenziel */}
        <div className="pd-tile" onClick={() => setOverlay('wochenziel')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Wochenziel</div>
          </div>
          <div className="pd-tile-val">23 <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink2)' }}>/ 25 Chargen</span></div>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 8, background: 'var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: '92%', height: '100%', background: 'linear-gradient(90deg, var(--pos), var(--cyan))', borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pos)' }}>92%</span>
            </div>
          </div>
          <div className="pd-tile-desc" style={{ marginTop: 8 }}>Prognose: Ziel wird am Freitag um 14:00 Uhr erreicht</div>
          <div className="pd-tile-foot">Prognose ansehen <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Maßnahmenvorschläge */}
        <div className="pd-tile" onClick={() => setOverlay('massnahmen')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <Zap className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Maßnahmenvorschläge</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--pos)' }}>3</div>
          <div className="pd-tile-desc">Operative Handlungsempfehlungen basierend auf aktuellen Engpässen</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neg)', flexShrink: 0 }} />
              <span>Schleifen: 2. Schicht aktivieren</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
              <span>Politur: Wartung vorziehen</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pos)', flexShrink: 0 }} />
              <span>Express-Kontingent freigeben</span>
            </div>
          </div>
          <div className="pd-tile-foot">Details ansehen <ArrowRight className="w-3 h-3" /></div>
        </div>

      </div>

      {/* OVERLAYS — standardized AnalysisOverlay pattern */}
      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'termintreue'} onClose={() => setOverlay(null)} icon={<Clock className="w-5 h-5" style={{ color: 'var(--neg)' }} />} title="Termintreue" subtitle="Pünktlich gelieferte Aufträge — Werkstatt-Performance" accentBg="linear-gradient(180deg, var(--negbg), transparent)" hero={{ kicker: "Wie pünktlich lieferst du", value: "76 %", changePill: { text: "▼ −9 Pkt. vs. Vorjahr", variant: "red" }, meta: "KW22 · Tendenz fallend seit 4 Wochen", sparkValues: [85, 82, 79, 76] }} crossKpi={[ { label: "KW22 vs. Vorjahr", value: "−9 Pkt.", delta: "85% → 76%", deltaColor: "var(--neg)", accentColor: "var(--neg)" }, { label: "Überfällige Aufträge", value: "8", delta: "Station Schleifen", deltaColor: "var(--neg)", accentColor: "var(--neg)" }, { label: "Prognose", value: "72 %", delta: "Ohne Gegenmaßnahme", deltaColor: "var(--neg)", accentColor: "var(--warn)" } ]} insight={{ body: "<b>Beobachtung:</b> Termintreue seit 4 Wochen rückläufig (85% → 76%). Hauptgrund: Engpass bei Schleifen (14 Aufträge) und verzögerte Zulieferungen.<br><b>Prognose:</b> Ohne Gegenmaßnahme sinkt die Termintreue bis Monatsende auf ca. 72%.<br><b>Empfehlung:</b> 2. Schicht Schleifen aktivieren. Express-Aufträge temporär auf Politur umleiten.", actions: [{ label: "2. Schicht aktivieren" }, { label: "Engpass-Aufträge anzeigen" }] }} linkedAreas={[{ label: "Auftragsbuch", href: "/orders" }, { label: "Warendurchlauf", href: "/warendurchlauf" }, { label: "Qualitätskontrolle", href: "/kontrolle" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'durchlaufzeit'} onClose={() => setOverlay(null)} icon={<Target className="w-5 h-5" style={{ color: 'var(--warn)' }} />} title="Durchlaufzeit" subtitle="Mittlere Verweildauer je Station" accentBg="linear-gradient(180deg, var(--warnbg), transparent)" hero={{ kicker: "Wie lange braucht ein Auftrag", value: "Ø 9,4 Tage", changePill: { text: "Schleifen = 30% der Gesamtzeit", variant: "amber" }, meta: "5 Stationen · Schleifen und Politur sind die Zeitfresser" }} composition={{ title: "C · Durchlaufzeit pro Station", rows: [ { avatar: "S", avatarColor: "#D14F3D", name: "Schleifen", meta: "2,8 Tage · Engpass: 14 Aufträge im Stau", amount: "2,8 T" }, { avatar: "P", avatarColor: "#FBBF24", name: "Politur", meta: "2,3 Tage · Wartung fällig in 3 Tagen", amount: "2,3 T" }, { avatar: "G", avatarColor: "#34D399", name: "Galvanik", meta: "1,9 Tage · Stabil, Nickelbad beobachten", amount: "1,9 T" }, { avatar: "V", avatarColor: "#60A5FA", name: "Vorbereitung", meta: "1,2 Tage · Unterausgelastet — Express möglich", amount: "1,2 T" }, { avatar: "Q", avatarColor: "#A78BFA", name: "QK und Versand", meta: "1,2 Tage · Stabil", amount: "1,2 T" } ] }} insight={{ body: "<b>Beobachtung:</b> Schleifen und Politur machen 54% der Gesamtdurchlaufzeit aus. Vorbereitung ist unterausgelastet und könnte Express-Aufträge übernehmen." }} linkedAreas={[{ label: "Warendurchlauf", href: "/warendurchlauf" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'engpass'} onClose={() => setOverlay(null)} icon={<AlertOctagon className="w-5 h-5" style={{ color: 'var(--neg)' }} />} title="Engpassstation" subtitle="Schleifen — 94% Auslastung, 14 Aufträge im Stau" accentBg="linear-gradient(180deg, var(--negbg), transparent)" hero={{ kicker: "Wo staut es sich", value: "Schleifen", changePill: { text: "94% Auslastung", variant: "red" }, meta: "14 Aufträge im Stau · 8 mit akutem Terminrisiko" }} crossKpi={[ { label: "Auslastung", value: "94 %", delta: "Höchste aller Stationen", deltaColor: "var(--neg)", accentColor: "var(--neg)" }, { label: "Stau-Aufträge", value: "14", delta: "8 mit Terminrisiko", deltaColor: "var(--neg)", accentColor: "var(--neg)" }, { label: "Maschine in Wartung", value: "1 von 3", delta: "Seit Montag", deltaColor: "var(--warn)", accentColor: "var(--warn)" } ]} insight={{ body: "<b>Ursache:</b> Erhöhter Anteil an Sonderbearbeitungen und 1 Maschine seit Mo. in Wartung.<br><b>Folge:</b> 14 Aufträge stauen sich, 8 davon mit akutem Terminrisiko.<br><b>Empfehlung:</b> 2. Schicht für Do/Fr aktivieren oder Express-Aufträge temporär auf Politur umleiten.", actions: [{ label: "2. Schicht aktivieren" }, { label: "Umleitung einrichten" }] }} linkedAreas={[{ label: "Warendurchlauf", href: "/warendurchlauf" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'terminrisiko'} onClose={() => setOverlay(null)} icon={<Clock className="w-5 h-5" style={{ color: 'var(--neg)' }} />} title="Terminrisiko-Liste" subtitle="Gefährdete und überfällige Aufträge" accentBg="linear-gradient(180deg, var(--negbg), transparent)" hero={{ kicker: "Welche Aufträge sind gefährdet", value: "8 Aufträge", changePill: { text: "2 bereits überfällig", variant: "red" }, meta: "Station Schleifen und Politur betroffen" }} composition={{ title: "C · Betroffene Aufträge · 8 Stück", rows: [ { avatar: "ML", avatarColor: "#D14F3D", name: "A-0089 — Museum Lenzburg", meta: "4.200 € · Schleifen · −2 Tage überfällig", amount: "−2 T" }, { avatar: "AB", avatarColor: "#D14F3D", name: "A-0091 — Autohaus Berger", meta: "2.800 € · Politur · −1 Tag überfällig", amount: "−1 T" }, { avatar: "SB", avatarColor: "#FBBF24", name: "A-0094 — Schlosserei Brunner", meta: "1.600 € · Galvanik · Frist Heute", amount: "Heute" }, { avatar: "UK", avatarColor: "#FBBF24", name: "A-0095 — Uhren Keller", meta: "3.400 € · Schleifen · Frist Heute", amount: "Heute" }, { avatar: "MZ", avatarColor: "#60A5FA", name: "A-0098 — Metallbau Zürich", meta: "2.200 € · Vorbereitung · +1 Tag", amount: "+1 T" }, { avatar: "PK", avatarColor: "#60A5FA", name: "A-0101 — Privatauftrag K.", meta: "1.100 € · Galvanik · +1 Tag", amount: "+1 T" }, { avatar: "SL", avatarColor: "#60A5FA", name: "A-0103 — Schmuck Lutz", meta: "3.800 € · Schleifen · +2 Tage", amount: "+2 T" }, { avatar: "AN", avatarColor: "#60A5FA", name: "A-0107 — Antiquitäten Bern", meta: "3.300 € · Politur · +2 Tage", amount: "+2 T" } ] }} insight={{ body: "<b>Beobachtung:</b> 2 Aufträge bereits überfällig, 2 weitere auf Kante (Frist Heute). 6 Aufträge in den Stationen Schleifen und Politur betroffen.<br><b>Empfehlung:</b> Museum Lenzburg und Autohaus Berger priorisieren. Kunden über Verzögerung informieren.", actions: [{ label: "Kunden benachrichtigen" }, { label: "Priorisierung anpassen" }] }} linkedAreas={[{ label: "Auftragsbuch", href: "/orders" }, { label: "Warendurchlauf", href: "/warendurchlauf" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'wochenziel'} onClose={() => setOverlay(null)} icon={<CheckCircle2 className="w-5 h-5" style={{ color: 'var(--pos)' }} />} title="Wochenziel" subtitle="Chargen-Fortschritt · Prognose" accentBg="linear-gradient(180deg, var(--posbg), transparent)" hero={{ kicker: "Wie weit ist das Wochenziel", value: "23 / 25", changePill: { text: "92% erreicht — auf Kurs", variant: "teal" }, meta: "Prognose: Freitag 14:00 Uhr · 2 Express-Chargen könnten beschleunigen", sparkValues: [5, 10, 14, 18, 23] }} insight={{ body: "<b>Beobachtung:</b> 23 von 25 Chargen abgeschlossen (92%). Bei aktuellem Tempo wird das Ziel bis Freitag 14:00 erreicht.<br><b>Chance:</b> 2 Express-Chargen könnten das Ziel bereits bis Donnerstag sichern.", actions: [{ label: "Express-Chargen freigeben" }] }} linkedAreas={[{ label: "Warendurchlauf", href: "/warendurchlauf" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'massnahmen'} onClose={() => setOverlay(null)} icon={<Zap className="w-5 h-5" style={{ color: 'var(--pos)' }} />} title="Maßnahmenvorschläge" subtitle="3 operative Handlungsempfehlungen für diese Woche" accentBg="linear-gradient(180deg, var(--posbg), transparent)" hero={{ kicker: "Was solltest du tun", value: "3 Maßnahmen", changePill: { text: "1 hochprioritär", variant: "amber" }, meta: "Basierend auf aktuellen Engpässen und Auslastung" }} composition={{ title: "C · Maßnahmen nach Priorität", rows: [ { avatar: "!", avatarColor: "#D14F3D", name: "Schleifen: 2. Schicht aktivieren", meta: "Priorität Hoch · Signal: 94% Auslastung · Erwartung: Stau −50%, Termintreue +5 Pkt.", amount: "" }, { avatar: "⚙", avatarColor: "#FBBF24", name: "Politur: Wartung vorziehen", meta: "Priorität Mittel · Signal: Wartung überfällig · Erwartung: Stillstand vermeiden", amount: "" }, { avatar: "⚡", avatarColor: "#34D399", name: "Express-Kontingent freigeben", meta: "Priorität Niedrig · Signal: Vorbereitung unterausgelastet · Erwartung: +800 €/Tag", amount: "" } ] }} insight={{ body: "<b>Gesamteinschätzung:</b> Die wichtigste Maßnahme ist die 2. Schicht bei Schleifen. Damit wird der Stau halbiert und die Termintreue stabilisiert sich. Politur-Wartung sollte auf Samstag vorgezogen werden, um ungeplanten Stillstand nächste Woche zu vermeiden.", actions: [{ label: "2. Schicht anweisen" }, { label: "Wartung planen" }, { label: "Express freigeben" }] }} linkedAreas={[{ label: "Warendurchlauf", href: "/warendurchlauf" }, { label: "Auftragsbuch", href: "/orders" }, { label: "Qualitätskontrolle", href: "/kontrolle" }]} />

      {/* Analytics Drill Drawer (B1) */}
      {drillKpi && (
        <AnalyticsDrillDrawer
          kpiId={drillKpi}
          period={drillPeriod}
          onPeriodChange={setDrillPeriod}
          onClose={() => setDrillKpi(null)}
        />
      )}
    </PerformanceDetailLayout>
  );
}
