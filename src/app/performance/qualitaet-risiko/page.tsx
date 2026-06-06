"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ShieldCheck, ArrowRight, AlertCircle, Activity, MessageCircle, Shield } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { AnalysisOverlay } from '@/components/ui/AnalysisOverlay';

export default function QualitaetRisikoDetail() {
  const [overlay, setOverlay] = useState<string | null>(null);

  return (
    <PerformanceDetailLayout
      title="Qualität und Risiko"
      subtitle="Reklamationsquote, Ursachenanalyse, Risikoaufträge und Präventionsmaßnahmen — das Frühwarnsystem des Betriebs."
      icon={<AlertTriangle className="w-6 h-6" style={{ color: '#fff' }} />}
      accentColor="rgba(251,191,36,0.18)"
      pill={{ label: '2 AKTIV', variant: 'yellow' }}
    >
      <div className="pd-grid">

        {/* Reklamationsquote */}
        <div className="pd-tile" onClick={() => setOverlay('reklamation')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--warnbg)' }}>
              <AlertCircle className="w-5 h-5" style={{ color: 'var(--warn)' }} />
            </div>
            <div className="pd-tile-name">Reklamationsquote</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--warn)' }}>7,1%</div>
          <div className="pd-tile-desc">2 von 28 Aufträgen · ▲ +1 vs. Vorjahr</div>
          <div style={{ marginTop: 12, display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--bd)' }}>
            <div style={{ width: '92.9%', background: 'var(--pos)', fontSize: 9, color: '#fff', paddingLeft: 6, lineHeight: '18px' }}>OK (92,9%)</div>
            <div style={{ width: '7.1%', background: 'var(--neg)', fontSize: 9, color: '#fff', textAlign: 'right', paddingRight: 4, lineHeight: '18px' }}>NOK</div>
          </div>
          <div className="pd-tile-foot">Trend analysieren <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Ursachen */}
        <div className="pd-tile" onClick={() => setOverlay('ursachen')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--negbg)' }}>
              <ShieldCheck className="w-5 h-5" style={{ color: 'var(--neg)' }} />
            </div>
            <div className="pd-tile-name">Ursachenanalyse</div>
          </div>
          <div className="pd-tile-desc" style={{ marginTop: 8 }}>Verteilung der häufigsten Fehlerursachen</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Pickelbildung</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '45%', background: 'var(--neg)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--neg)' }}>45%</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Maßabweichg.</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '30%', background: 'var(--warn)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--warn)' }}>30%</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Kratzer</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '25%', background: 'var(--info)' }} /></div>
              <div className="pd-bar-val">25%</div>
            </div>
          </div>
          <div className="pd-tile-foot">Details <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Betroffene Stationen → /kontrolle */}
        <Link href="/kontrolle" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
                <Activity className="w-5 h-5" style={{ color: 'var(--info)' }} />
              </div>
              <div className="pd-tile-name">Betroffene Stationen</div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { s: 'Galvanik-Zink (Bad 2)', f: 3, c: 'var(--neg)' },
                { s: 'Politur manuell', f: 1, c: 'var(--warn)' },
                { s: 'Schleifen', f: 0, c: 'var(--pos)' },
              ].map(st => (
                <div key={st.s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--bd)' }}>
                  <span style={{ fontWeight: 500 }}>{st.s}</span>
                  <span style={{ fontWeight: 700, color: st.c }}>{st.f} Fehler</span>
                </div>
              ))}
            </div>
            <div className="pd-tile-foot">Zur Qualitätskontrolle <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Nacharbeit */}
        <div className="pd-tile" onClick={() => setOverlay('nacharbeit')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--warnbg)' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warn)' }} />
            </div>
            <div className="pd-tile-name">Nacharbeit</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--warn)' }}>420 € / Wo.</div>
          <div className="pd-tile-desc">Durchschnittliche Kosten für Nachbearbeitung und Neuanfertigung</div>
          <div className="pd-mini-bars">
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '30%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '25%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--warn)', height: '55%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--neg)', height: '70%' }} />
          </div>
          <div className="pd-mini-bar-labels"><span>KW19</span><span>KW20</span><span>KW21</span><span>KW22</span></div>
          <div className="pd-tile-foot">Kostenanalyse <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Risikoaufträge → /orders */}
        <Link href="/orders" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--negbg)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--neg)' }} />
              </div>
              <div className="pd-tile-name">Risikoaufträge</div>
            </div>
            <div className="pd-tile-val" style={{ color: 'var(--neg)' }}>3</div>
            <div className="pd-tile-desc">Aufträge drohen in die Vertragsstrafe zu laufen</div>
            <div style={{ marginTop: 10, padding: 10, background: 'var(--negbg)', borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}>
              <strong>A-2026-0042:</strong> 84% Risiko · 6 Kunden überfällig (11.200 €)
            </div>
            <div className="pd-heatmap" style={{ marginTop: 10 }}>
              {[95, 84, 72, 60, 45, 30, 25, 20, 15, 10].map((v, i) => (
                <div key={i} className="pd-heatmap-cell" style={{ background: v > 70 ? 'var(--neg)' : v > 40 ? 'var(--warn)' : 'var(--pos)', opacity: 0.5 + (v / 100) * 0.5 }} title={`Auftrag ${i + 1}: ${v}% Risiko`} />
              ))}
            </div>
            <div style={{ fontSize: 9, color: 'var(--ink3)', textAlign: 'center', marginTop: 4 }}>Risiko-Score der Top 10 Aufträge</div>
            <div className="pd-tile-foot">Zum Auftragsbuch <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Kommunikationsrisiken → /kommunikation */}
        <Link href="/kommunikation" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--purpbg)' }}>
                <MessageCircle className="w-5 h-5" style={{ color: 'var(--purple)' }} />
              </div>
              <div className="pd-tile-name">Kommunikationsrisiken</div>
            </div>
            <div className="pd-tile-val" style={{ color: 'var(--purple)' }}>2</div>
            <div className="pd-tile-desc">Kunden warten auf Antwort oder haben Mahnung erhalten</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ padding: 8, background: 'var(--negbg)', borderRadius: 8, fontSize: 11, lineHeight: 1.4 }}>
                <strong>Autohaus Berger</strong> — wartet seit 3 Tagen auf Antwort
              </div>
              <div style={{ padding: 8, background: 'var(--warnbg)', borderRadius: 8, fontSize: 11, lineHeight: 1.4 }}>
                <strong>Schlosserei Brunner</strong> — Mahnung erhalten
              </div>
            </div>
            <div className="pd-tile-foot">Zum Kommunikations-Center <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Präventionsmaßnahmen */}
        <div className="pd-tile" onClick={() => setOverlay('praevention')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <Shield className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Präventionsmaßnahmen</div>
          </div>
          <div className="pd-tile-desc" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5 }}>Geplante und laufende Maßnahmen zur Fehlervermeidung.</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pos)', flexShrink: 0 }} />
              <span>Neue Bad-Filter bestellt (Eintreffen 12.06.)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
              <span>Politur: Kalibrierung nächste Woche</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--info)', flexShrink: 0 }} />
              <span>Checkliste aktualisiert (Eingangskontrolle)</span>
            </div>
          </div>
          <div className="pd-tile-foot">Alle Maßnahmen <ArrowRight className="w-3 h-3" /></div>
        </div>


      </div>

      {/* OVERLAYS — standardized AnalysisOverlay pattern */}
      <AnalysisOverlay open={overlay === 'reklamation'} onClose={() => setOverlay(null)} icon={<AlertCircle className="w-5 h-5" style={{ color: 'var(--warn)' }} />} title="Reklamationsquote" subtitle="Trendanalyse · Fehlerquote · Monatsvergleich" accentBg="linear-gradient(180deg, var(--warnbg), transparent)" hero={{ kicker: "Wie hoch ist die Reklamationsquote", value: "7,1 %", changePill: { text: "▲ +1 vs. Vorjahr — steigend", variant: "red" }, meta: "2 von 28 Aufträgen · Tendenz steigend seit 4 Monaten", sparkValues: [3.2, 4.1, 5.8, 7.1] }} crossKpi={[ { label: "Feb", value: "3,2 %", delta: "Niedrig", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Mär", value: "4,1 %", delta: "Leicht steigend", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Apr", value: "5,8 %", delta: "Warnung", deltaColor: "var(--warn)", accentColor: "var(--warn)" }, { label: "Mai", value: "7,1 %", delta: "Kritisch", deltaColor: "var(--neg)", accentColor: "var(--neg)" } ]} insight={{ body: "<b>Tendenz:</b> Steigend. Hauptursache ist die Verschlechterung des Nickelbads und fehlende Kalibrierung der Poliermaschine.<br><b>Empfehlung:</b> Sofortige Bad-Filter-Bestellung und Poliermaschinen-Kalibrierung vorziehen.", actions: [{ label: "Qualitätskontrolle öffnen" }, { label: "Maßnahmen prüfen" }] }} linkedAreas={[{ label: "Qualitätskontrolle", href: "/kontrolle" }, { label: "Bäder-Management", href: "/baeder" }]} />

      <AnalysisOverlay open={overlay === 'ursachen'} onClose={() => setOverlay(null)} icon={<ShieldCheck className="w-5 h-5" style={{ color: 'var(--neg)' }} />} title="Ursachenanalyse" subtitle="Verteilung der häufigsten Fehlerursachen" accentBg="linear-gradient(180deg, var(--negbg), transparent)" hero={{ kicker: "Was geht schief", value: "3 Fehlertypen", changePill: { text: "Pickelbildung führt (45%)", variant: "red" }, meta: "3 Stationen betroffen · Lösungen in Umsetzung" }} composition={{ title: "C · Fehlerursachen im Detail", rows: [ { avatar: "P", avatarColor: "#D14F3D", name: "Pickelbildung", meta: "45% · Galvanik-Zink (Bad 2) · Verunreinigte Badchemie · Lösung: Neue Filter bestellt", amount: "45 %" }, { avatar: "M", avatarColor: "#FBBF24", name: "Maßabweichung", meta: "30% · Politur manuell · Kalibrierfehler · Lösung: Kalibrierung geplant", amount: "30 %" }, { avatar: "K", avatarColor: "#60A5FA", name: "Kratzer", meta: "25% · Schleifen · Schleifscheibe verschlissen · Lösung: Austausch am Wochenende", amount: "25 %" } ] }} insight={{ body: "<b>Beobachtung:</b> Pickelbildung ist die häufigste Ursache (45%) und direkt auf das verschlechterte Nickelbad (PH 6,3) zurückzuführen.<br><b>Zusammenhang:</b> Korreliert mit den Ergebnissen aus der Badstatus-Analyse." }} linkedAreas={[{ label: "Qualitätskontrolle", href: "/kontrolle" }, { label: "Bäder-Management", href: "/baeder" }]} />

      <AnalysisOverlay open={overlay === 'nacharbeit'} onClose={() => setOverlay(null)} icon={<AlertTriangle className="w-5 h-5" style={{ color: 'var(--warn)' }} />} title="Nacharbeitskosten" subtitle="Material · Arbeitszeit · Express-Zuschlag" accentBg="linear-gradient(180deg, var(--warnbg), transparent)" hero={{ kicker: "Was kostet dich Nacharbeit", value: "420 €/Wo.", changePill: { text: "~1.680 €/Monat — 4% vom DB", variant: "amber" }, meta: "Material + Arbeitszeit + Express-Zuschlag", sparkValues: [180, 150, 340, 420] }} crossKpi={[ { label: "Hochrechnung Mai", value: "1.680 €", delta: "4% vom Deckungsbeitrag", deltaColor: "var(--warn)", accentColor: "var(--warn)" }, { label: "Material-Anteil", value: "~40 %", delta: "Neuanfertigung", deltaColor: "var(--info)", accentColor: "var(--info)" }, { label: "Express-Anteil", value: "~25 %", delta: "Verspätete Lieferung", deltaColor: "var(--neg)", accentColor: "var(--neg)" } ]} insight={{ body: "<b>Beobachtung:</b> 420 €/Woche = ~1.680 €/Monat. Das sind 4% des Deckungsbeitrags.<br><b>Empfehlung:</b> Senkung der Fehlerquote durch Präventionsmaßnahmen würde direkt die Marge verbessern." }} linkedAreas={[{ label: "BWA", href: "/buchhaltung/bwa" }, { label: "Qualitätskontrolle", href: "/kontrolle" }]} />

      <AnalysisOverlay open={overlay === 'praevention'} onClose={() => setOverlay(null)} icon={<Shield className="w-5 h-5" style={{ color: 'var(--pos)' }} />} title="Präventionsmaßnahmen" subtitle="Laufende und geplante Maßnahmen" accentBg="linear-gradient(180deg, var(--posbg), transparent)" hero={{ kicker: "Was tust du gegen Fehler", value: "4 Maßnahmen", changePill: { text: "1 umgesetzt, 1 bestellt, 2 geplant", variant: "teal" }, meta: "Zielsenkung: Reklamationsquote → ≤4%" }} composition={{ title: "C · Maßnahmen übersicht", rows: [ { avatar: "✔", avatarColor: "#34D399", name: "Eingangskontrolle-Checkliste", meta: "Status: Umgesetzt · Nutzen: Früheres Erkennen fehlerhafter Zulieferteile", amount: "Erledigt" }, { avatar: "📦", avatarColor: "#60A5FA", name: "Neue Bad-Filter (Galvanik-Zink)", meta: "Status: Bestellt · Eintreffen 12.06. · Nutzen: Senkung Pickelbildung um ~60%", amount: "12.06." }, { avatar: "⚙", avatarColor: "#FBBF24", name: "Kalibrierung Poliermaschine", meta: "Status: Geplant · KW24 Samstag · Nutzen: Reduktion Maßabweichungen", amount: "KW24" }, { avatar: "📋", avatarColor: "#FBBF24", name: "Schulung Schleifpersonal", meta: "Status: Geplant · KW25 · Nutzen: Weniger Kratzer durch bessere Technik", amount: "KW25" } ] }} insight={{ body: "<b>Beobachtung:</b> 4 Maßnahmen aktiv. Die wichtigsten (Bad-Filter + Kalibrierung) werden in den nächsten 2 Wochen umgesetzt.<br><b>Prognose:</b> Bei erfolgreicher Umsetzung aller Maßnahmen sinkt die Reklamationsquote voraussichtlich auf ≤4%." }} linkedAreas={[{ label: "Qualitätskontrolle", href: "/kontrolle" }, { label: "Bäder-Management", href: "/baeder" }]} />
    </PerformanceDetailLayout>
  );
}
