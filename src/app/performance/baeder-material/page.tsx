"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import React, { useState } from 'react';
import { FlaskConical, ArrowRight, BarChart3, AlertTriangle, Package, Droplets } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { AnalysisOverlay } from '@/components/ui/AnalysisOverlay';

export default function BaederMaterialDetail() {
  const [overlay, setOverlay] = useState<string | null>(null);

  return (
    <PerformanceDetailLayout
      title="Bäder und Material"
      subtitle="Badstatus, Chemiebestand, Metallverbrauch, Einkaufspreise und Margen — die Rohstoff-Perspektive."
      icon={<FlaskConical className="w-6 h-6" style={{ color: '#fff' }} />}
      accentColor="rgba(251,191,36,0.18)"
      pill={{ label: '1 BEOBACHTEN', variant: 'yellow' }}
    >
      <div className="pd-grid">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Performance',href:'/performance'}, {label:'Baeder-material'}]} />
        <BackButton label="Performance" href="/performance" />
      </div>
      

        {/* Badstatus — In-Place Overlay */}
        <div className="pd-tile" onClick={() => setOverlay('badstatus')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <Droplets className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Badstatus</div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Zinkbad</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '100%', background: 'var(--pos)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--pos)' }}>OK</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Chrombad</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '85%', background: 'var(--info)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--info)' }}>OK</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Nickelbad</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '30%', background: 'var(--warn)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--warn)' }}>Kritisch</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Goldbad</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '72%', background: 'var(--pos)' }} /></div>
              <div className="pd-bar-val" style={{ color: 'var(--pos)' }}>OK</div>
            </div>
          </div>
          <div className="pd-tile-foot">Badstatus analysieren <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Kritische Bäder */}
        <div className="pd-tile" onClick={() => setOverlay('kritisch')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--warnbg)' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warn)' }} />
            </div>
            <div className="pd-tile-name">Kritische Bäder</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--warn)' }}>1</div>
          <div className="pd-tile-desc">Nickelbad 1 — PH-Wert grenzwertig (Toleranz −0,2)</div>
          <div className="pd-heatmap" style={{ marginTop: 12 }}>
            {[7.2, 7.1, 7.0, 6.9, 6.8, 6.7, 6.6, 6.5, 6.4, 6.3].map((v, i) => (
              <div key={i} className="pd-heatmap-cell" style={{ background: v > 6.8 ? 'var(--pos)' : v > 6.5 ? 'var(--warn)' : 'var(--neg)', opacity: 0.6 + (1 - (v - 6.3) / 0.9) * 0.4 }} title={`Tag ${i + 1}: PH ${v}`} />
            ))}
          </div>
          <div style={{ fontSize: 9, color: 'var(--ink3)', textAlign: 'center', marginTop: 4 }}>PH-Wert Nickelbad, letzte 10 Tage (fallend)</div>
          <div className="pd-tile-foot">Werte analysieren <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Chemiebestand — In-Place Overlay */}
        <div className="pd-tile" onClick={() => setOverlay('chemie')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--purpbg)' }}>
              <Package className="w-5 h-5" style={{ color: 'var(--purple)' }} />
            </div>
            <div className="pd-tile-name">Chemiebestand</div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { name: 'Salzsäure', bestand: 'Niedrig', tage: 4, c: 'var(--neg)' },
              { name: 'Nickelsalz', bestand: 'Mittel', tage: 12, c: 'var(--warn)' },
              { name: 'Zinksalz', bestand: 'Voll', tage: 30, c: 'var(--pos)' },
              { name: 'Chromsäure', bestand: 'Gut', tage: 22, c: 'var(--pos)' },
            ].map(c => (
              <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--bd)' }}>
                <span style={{ fontWeight: 500 }}>{c.name}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: c.c, fontWeight: 600, fontSize: 10 }}>{c.bestand}</span>
                  <span style={{ color: 'var(--ink2)', fontSize: 10 }}>≈{c.tage} Tage</span>
                </div>
              </div>
            ))}
          </div>
          <div className="pd-tile-foot">Bestandsanalyse <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Metallverbrauch */}
        <div className="pd-tile" onClick={() => setOverlay('verbrauch')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
              <BarChart3 className="w-5 h-5" style={{ color: 'var(--info)' }} />
            </div>
            <div className="pd-tile-name">Metallverbrauch</div>
          </div>
          <div className="pd-tile-desc" style={{ marginTop: 8 }}>Verbrauch pro Metall diese Woche</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Gold</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '42%', background: '#FBBF24' }} /></div>
              <div className="pd-bar-val">42g</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Silber</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '65%', background: '#94A3B8' }} /></div>
              <div className="pd-bar-val">180g</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Kupfer</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '80%', background: '#D97706' }} /></div>
              <div className="pd-bar-val">2,4kg</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">Nickel</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '55%', background: '#86EFAC' }} /></div>
              <div className="pd-bar-val">1,8kg</div>
            </div>
          </div>
          <div className="pd-tile-foot">Verbrauchsanalyse <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Metallmarge */}
        <div className="pd-tile" onClick={() => setOverlay('marge')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <FlaskConical className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Metallmarge</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--pos)' }}>+2.840 €</div>
          <div className="pd-tile-desc">Gold +14% seit Badkauf · Silber stabil · Kupfer fällt</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '4px 10px', background: 'var(--posbg)', color: 'var(--pos)', borderRadius: 6, fontWeight: 600 }}>Gold +14%</span>
            <span style={{ fontSize: 10, padding: '4px 10px', background: 'var(--sf2)', color: 'var(--ink2)', borderRadius: 6, fontWeight: 600 }}>Silber ±0%</span>
            <span style={{ fontSize: 10, padding: '4px 10px', background: 'var(--negbg)', color: 'var(--neg)', borderRadius: 6, fontWeight: 600 }}>Kupfer −3%</span>
          </div>
          <div className="pd-tile-foot">Margenanalyse <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Einkaufspreis vs. Tagespreis */}
        <div className="pd-tile" onClick={() => setOverlay('preise')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--warnbg)' }}>
              <BarChart3 className="w-5 h-5" style={{ color: 'var(--warn)' }} />
            </div>
            <div className="pd-tile-name">Einkauf vs. Tagespreis</div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { metall: 'Gold', ek: '60,00 €/g', tp: '68,40 €/g', diff: '+14,0%', c: 'var(--pos)' },
              { metall: 'Silber', ek: '0,95 €/g', tp: '0,98 €/g', diff: '+3,2%', c: 'var(--pos)' },
              { metall: 'Kupfer', ek: '9,10 €/kg', tp: '8,78 €/kg', diff: '−3,5%', c: 'var(--neg)' },
              { metall: 'Nickel', ek: '15,20 €/kg', tp: '15,90 €/kg', diff: '+4,6%', c: 'var(--pos)' },
            ].map(p => (
              <div key={p.metall} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
                <span style={{ fontWeight: 600, width: 60 }}>{p.metall}</span>
                <span style={{ color: 'var(--ink2)' }}>EK: {p.ek}</span>
                <span style={{ color: 'var(--ink2)' }}>TP: {p.tp}</span>
                <span style={{ fontWeight: 700, color: p.c }}>{p.diff}</span>
              </div>
            ))}
          </div>
          <div className="pd-tile-foot">Preistabelle <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Betroffene Aufträge — In-Place Overlay */}
        <div className="pd-tile" onClick={() => setOverlay('auftraege')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
              <Package className="w-5 h-5" style={{ color: 'var(--info)' }} />
            </div>
            <div className="pd-tile-name">Betroffene Aufträge</div>
          </div>
          <div className="pd-tile-val">3</div>
          <div className="pd-tile-desc">Großaufträge im Bereich Vergolden warten auf Freigabe</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--bd)' }}>
              <span style={{ fontWeight: 600 }}>A-2026-0112</span><span style={{ color: 'var(--ink2)' }}>Vergolden, 120 Teile</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--bd)' }}>
              <span style={{ fontWeight: 600 }}>A-2026-0115</span><span style={{ color: 'var(--ink2)' }}>Vergolden, 45 Teile</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ fontWeight: 600 }}>A-2026-0118</span><span style={{ color: 'var(--ink2)' }}>Vergolden, 80 Teile</span>
            </div>
          </div>
          <div className="pd-tile-foot">Auftragsdetails <ArrowRight className="w-3 h-3" /></div>
        </div>


      </div>

      {/* OVERLAYS — standardized AnalysisOverlay pattern */}
      <AnalysisOverlay
        open={overlay === 'badstatus'}
        onClose={() => setOverlay(null)}
        icon={<Droplets className="w-5 h-5" style={{ color: 'var(--pos)' }} />}
        title="Badstatus"
        subtitle="Zink · Chrom · Nickel · Gold — alle aktiven Galvanikbäder"
        accentBg="linear-gradient(180deg, var(--posbg), transparent)"
        hero={{
          kicker: "Wie stehen deine Bäder",
          value: "3 von 4 OK",
          changePill: { text: "1 kritisch — Nickelbad", variant: "amber" },
          meta: "Stand 05.06.2026 · Letzte Messung 09:14 · 4 aktive Bäder",
          sparkValues: [7.2, 7.1, 7.0, 6.9, 6.8, 6.7, 6.6, 6.5, 6.4, 6.3],
        }}
        composition={{
          title: "C · Alle Bäder im Detail · 4 aktiv",
          rows: [
            { avatar: "Z", avatarColor: "#34D399", name: "Zinkbad", meta: "PH 7,2 · 24°C · Wartung 28.05.", amount: "OK" },
            { avatar: "C", avatarColor: "#60A5FA", name: "Chrombad", meta: "PH 6,9 · 52°C · Wartung 01.06.", amount: "OK" },
            { avatar: "N", avatarColor: "#FBBF24", name: "Nickelbad 1", meta: "PH 6,3 · 58°C · Wartung 15.05. — KRITISCH", amount: "⚠" },
            { avatar: "G", avatarColor: "#34D399", name: "Goldbad", meta: "PH 7,0 · 62°C · Wartung 03.06.", amount: "OK" },
          ],
        }}
        crossKpi={[
          { label: "PH Nickelbad", value: "6,3", delta: "▼ −0,2 unter Grenzwert", deltaColor: "var(--neg)", accentColor: "var(--neg)" },
          { label: "Tage seit letzter Wartung", value: "21 T", delta: "Nickelbad — überfällig", deltaColor: "var(--warn)", accentColor: "var(--warn)" },
          { label: "Betroffene Aufträge", value: "3", delta: "Vergolden, Charge wartet", deltaColor: "var(--warn)", accentColor: "var(--info)" },
          { label: "Nächste Wartung", value: "Fr 13.06.", delta: "automatisch aus Wartungsplan", deltaColor: "var(--pos)", accentColor: "var(--pos)" },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> Nickelbad 1 liegt mit PH 6,3 unter dem Grenzwert von 6,5. Der Wert fällt seit 10 Tagen kontinuierlich.<br><b>Vermutung:</b> Fehlende Nachdosierung nach dem letzten Großauftrag (Charge 405, 180 Teile).<br><b>Empfehlung:</b> Sofortige Nachdosierung und Filterreinigung. Schichtleiter informieren. Bei weiterem Absinken droht Pickelbildung und Reklamationen.",
          actions: [
            { label: "Wartung beauftragen" },
            { label: "Badregelkarte öffnen" },
            { label: "Als erledigt markieren" },
          ],
        }}
        linkedAreas={[
          { label: "Bäder-Management", href: "/baeder" },
          { label: "Warendurchlauf", href: "/warendurchlauf" },
          { label: "Auftragsbuch", href: "/orders" },
        ]}
      />

      <AnalysisOverlay
        open={overlay === 'kritisch'}
        onClose={() => setOverlay(null)}
        icon={<AlertTriangle className="w-5 h-5" style={{ color: 'var(--warn)' }} />}
        title="Kritische Bäder"
        subtitle="Nickelbad 1 — PH-Wert grenzwertig"
        accentBg="linear-gradient(180deg, var(--warnbg), transparent)"
        hero={{
          kicker: "Wie kritisch ist das Bad",
          value: "PH 6,3",
          changePill: { text: "−0,2 unter Grenzwert (6,5)", variant: "red" },
          meta: "Nickelbad 1 · Toleranzabweichung seit 10 Tagen fallend",
          sparkValues: [7.2, 7.1, 7.0, 6.9, 6.8, 6.7, 6.6, 6.5, 6.4, 6.3],
        }}
        crossKpi={[
          { label: "Idealwert", value: "7,0", delta: "Soll-PH für Nickelbad", deltaColor: "var(--pos)", accentColor: "var(--pos)" },
          { label: "Grenzwert", value: "6,5", delta: "Minimum — aktuell unterschritten", deltaColor: "var(--neg)", accentColor: "var(--neg)" },
          { label: "Reklamationsrisiko", value: "Hoch", delta: "Pickelbildung ab PH < 6,3", deltaColor: "var(--neg)", accentColor: "var(--neg)" },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> PH-Wert 6,3 — das sind 0,2 Punkte unter dem Mindest-PH von 6,5.<br><b>Ursache:</b> Vermutlich fehlende Nachdosierung nach Charge 405 (180 Teile vergangene Woche).<br><b>Sofortmaßnahme:</b> Filterreinigung + Nachdosierung Nickelsalz. Eskalation an Schichtleiter bei weiterer Verschlechterung.",
          actions: [
            { label: "Nachdosierung starten" },
            { label: "Schichtleiter benachrichtigen" },
          ],
        }}
        linkedAreas={[
          { label: "Bäder-Management", href: "/baeder" },
          { label: "Qualitätskontrolle", href: "/kontrolle" },
        ]}
      />

      <AnalysisOverlay
        open={overlay === 'chemie'}
        onClose={() => setOverlay(null)}
        icon={<Package className="w-5 h-5" style={{ color: 'var(--purple, #6D28D9)' }} />}
        title="Chemiebestand"
        subtitle="Salzsäure · Nickelsalz · Zinksalz · Chromsäure — Lageranalyse"
        accentBg="linear-gradient(180deg, var(--purpbg, rgba(167,139,250,.1)), transparent)"
        hero={{
          kicker: "Wie ist dein Chemiebestand",
          value: "1 kritisch",
          changePill: { text: "Salzsäure unter Schwelle", variant: "red" },
          meta: "4 Chemikalien überwacht · 1 unter Nachbestellschwelle",
        }}
        composition={{
          title: "C · Alle Chemikalien · 4 Positionen",
          rows: [
            { avatar: "H", avatarColor: "#D14F3D", name: "Salzsäure (HCl)", meta: "12 L · ≈4 Tage · Lieferant: ChemDirekt GmbH — KRITISCH", amount: "Bestellen" },
            { avatar: "N", avatarColor: "#FBBF24", name: "Nickelsalz (NiSO4)", meta: "8 kg · ≈12 Tage · Lieferant: Atotech", amount: "Mittel" },
            { avatar: "Z", avatarColor: "#34D399", name: "Zinksalz (ZnCl2)", meta: "25 kg · ≈30 Tage · Lieferant: ChemDirekt GmbH", amount: "Voll" },
            { avatar: "C", avatarColor: "#34D399", name: "Chromsäure (CrO3)", meta: "15 kg · ≈22 Tage · Lieferant: Enthone", amount: "Gut" },
          ],
        }}
        crossKpi={[
          { label: "Salzsäure Reichweite", value: "4 Tage", delta: "▼ unter Schwelle (10 T)", deltaColor: "var(--neg)", accentColor: "var(--neg)" },
          { label: "Chemie-Budget Monat", value: "1.840 €", delta: "72 % ausgeschöpft", deltaColor: "var(--warn)", accentColor: "var(--warn)" },
          { label: "Nächste Lieferung", value: "Mo 09.06.", delta: "ChemDirekt — bestellt", deltaColor: "var(--pos)", accentColor: "var(--pos)" },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> Salzsäure unter Nachbestellschwelle (4 Tage Reichweite, Schwelle 10 Tage).<br><b>Empfehlung:</b> Sofort bei ChemDirekt GmbH nachbestellen. Lieferzeit 2–3 Werktage. Bei Engpass droht Stillstand der Beizlinie.",
          actions: [
            { label: "Bestellung auslösen" },
            { label: "Lieferanten kontaktieren" },
          ],
        }}
        linkedAreas={[
          { label: "Materiallager", href: "/items" },
          { label: "Bäder-Management", href: "/baeder" },
        ]}
      />

      <AnalysisOverlay
        open={overlay === 'verbrauch'}
        onClose={() => setOverlay(null)}
        icon={<BarChart3 className="w-5 h-5" style={{ color: 'var(--info)' }} />}
        title="Metallverbrauch"
        subtitle="Gold · Silber · Kupfer · Nickel — Wochenverbrauch"
        accentBg="linear-gradient(180deg, var(--infobg), transparent)"
        hero={{
          kicker: "Wie viel Metall verbrauchst du",
          value: "4 Metalle",
          changePill: { text: "Gold −5g vs. Vorwoche", variant: "teal" },
          meta: "KW23 · Verbrauch im Vergleich zur Vorwoche",
        }}
        composition={{
          title: "C · Verbrauch pro Metall · Diese Woche",
          rows: [
            { avatar: "Au", avatarColor: "#FBBF24", name: "Gold", meta: "Aktuell: 42g · Vorwoche: 47g · −5g", amount: "42 g" },
            { avatar: "Ag", avatarColor: "#94A3B8", name: "Silber", meta: "Aktuell: 180g · Vorwoche: 175g · +5g", amount: "180 g" },
            { avatar: "Cu", avatarColor: "#D97706", name: "Kupfer", meta: "Aktuell: 2,4kg · Vorwoche: 2,6kg · −0,2kg", amount: "2,4 kg" },
            { avatar: "Ni", avatarColor: "#86EFAC", name: "Nickel", meta: "Aktuell: 1,8kg · Vorwoche: 1,9kg · −0,1kg", amount: "1,8 kg" },
          ],
        }}
        crossKpi={[
          { label: "Gold-Kosten/Woche", value: "2.873 €", delta: "bei 68,40 €/g Tagespreis", deltaColor: "var(--warn)", accentColor: "var(--warn)" },
          { label: "Metall-Gesamtkosten", value: "≈ 3.200 €", delta: "Wochenverbrauch × Tagespreis", deltaColor: "var(--ink2)", accentColor: "var(--info)" },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> Goldverbrauch leicht gesunken (−5g), Silber leicht gestiegen (+5g). Insgesamt stabile Woche.<br><b>Hinweis:</b> Goldpreis auf Jahreshoch (68,40 €/g). Sparsamerer Einsatz wirkt sich direkt auf die Marge aus.",
          actions: [
            { label: "Metallmarge prüfen" },
          ],
        }}
        linkedAreas={[
          { label: "Bäder-Management", href: "/baeder" },
          { label: "Materiallager", href: "/items" },
        ]}
      />

      <AnalysisOverlay
        open={overlay === 'marge'}
        onClose={() => setOverlay(null)}
        icon={<FlaskConical className="w-5 h-5" style={{ color: 'var(--pos)' }} />}
        title="Metallmarge"
        subtitle="Einkauf vs. Tagespreis — die Wertsteigerung deines Metallbestands"
        accentBg="linear-gradient(180deg, var(--posbg), transparent)"
        hero={{
          kicker: "Wie entwickelt sich deine Metallmarge",
          value: "+2.840 €",
          changePill: { text: "Gold treibt die Marge", variant: "teal" },
          meta: "Laufender Monat · Marktwert − Einkaufswert",
          sparkValues: [1800, 2000, 2100, 2300, 2500, 2700, 2840],
        }}
        composition={{
          title: "C · Margenentwicklung pro Metall",
          rows: [
            { avatar: "Au", avatarColor: "#FBBF24", name: "Gold", meta: "EK: 60,00 €/g · Tageskurs: 68,40 €/g · +14,0%", amount: "+2.100 €" },
            { avatar: "Ag", avatarColor: "#94A3B8", name: "Silber", meta: "EK: 0,95 €/g · Tageskurs: 0,98 €/g · +3,2%", amount: "+54 €" },
            { avatar: "Cu", avatarColor: "#D97706", name: "Kupfer", meta: "EK: 9,10 €/kg · Tageskurs: 8,78 €/kg · −3,5%", amount: "−77 €" },
            { avatar: "Ni", avatarColor: "#86EFAC", name: "Nickel", meta: "EK: 15,20 €/kg · Tageskurs: 15,90 €/kg · +4,6%", amount: "+126 €" },
          ],
        }}
        crossKpi={[
          { label: "Gold-Marge", value: "+14,0 %", delta: "Jahreshoch — Verkauf prüfen?", deltaColor: "var(--pos)", accentColor: "var(--pos)" },
          { label: "Kupfer-Marge", value: "−3,5 %", delta: "Tagespreis unter EK", deltaColor: "var(--neg)", accentColor: "var(--neg)" },
          { label: "Gesamt-Marge", value: "+2.840 €", delta: "↑ Tendenz steigend", deltaColor: "var(--pos)", accentColor: "var(--pos)" },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> Gold auf Jahreshoch (68,40 €/g), +14% über Einkaufspreis. Kupfer dagegen unter EK.<br><b>Warnung:</b> Ein Goldnachkauf zu aktuellen Preisen würde die Marge bei fallendem Preis gefährden.<br><b>Vorschlag:</b> Gold-Badreserven überprüfen und ggf. mit Teilverkauf Marge sichern.",
          actions: [
            { label: "Gold-Reserve prüfen" },
            { label: "Kupfer-Nachkauf bewerten" },
          ],
        }}
        linkedAreas={[
          { label: "Bäder-Management", href: "/baeder" },
          { label: "BWA Position Material", href: "/buchhaltung/bwa" },
        ]}
      />

      <AnalysisOverlay
        open={overlay === 'preise'}
        onClose={() => setOverlay(null)}
        icon={<BarChart3 className="w-5 h-5" style={{ color: 'var(--warn)' }} />}
        title="Einkauf vs. Tagespreis"
        subtitle="Preistabelle aller eingesetzten Metalle"
        accentBg="linear-gradient(180deg, var(--warnbg), transparent)"
        hero={{
          kicker: "Was kosten dich Metalle im Vergleich",
          value: "4 Metalle",
          changePill: { text: "Gold auf Jahreshoch", variant: "amber" },
          meta: "Vergleich Einkaufspreis vs. aktueller Marktpreis",
        }}
        composition={{
          title: "C · Preisvergleich pro Metall",
          rows: [
            { avatar: "Au", avatarColor: "#FBBF24", name: "Gold", meta: "EK: 60,00 €/g → TP: 68,40 €/g · +14,0%", amount: "+8,40 €/g" },
            { avatar: "Ag", avatarColor: "#94A3B8", name: "Silber", meta: "EK: 0,95 €/g → TP: 0,98 €/g · +3,2%", amount: "+0,03 €/g" },
            { avatar: "Cu", avatarColor: "#D97706", name: "Kupfer", meta: "EK: 9,10 €/kg → TP: 8,78 €/kg · −3,5%", amount: "−0,32 €/kg" },
            { avatar: "Ni", avatarColor: "#86EFAC", name: "Nickel", meta: "EK: 15,20 €/kg → TP: 15,90 €/kg · +4,6%", amount: "+0,70 €/kg" },
          ],
        }}
        insight={{
          body: "<b>Beobachtung:</b> 3 von 4 Metallen liegen über Einkaufspreis. Nur Kupfer ist aktuell unter EK (−3,5%).<br><b>Empfehlung:</b> Kupfer-Nachkauf bei aktuellem Preis wäre günstiger als beim letzten Einkauf. Gold-Nachkauf dagegen teurer — abwarten.",
          actions: [
            { label: "Einkaufshistorie öffnen" },
          ],
        }}
        linkedAreas={[
          { label: "Ausgaben & Kosten", href: "/buchhaltung/ausgaben" },
          { label: "BWA", href: "/buchhaltung/bwa" },
        ]}
      />

      <AnalysisOverlay
        open={overlay === 'auftraege'}
        onClose={() => setOverlay(null)}
        icon={<Package className="w-5 h-5" style={{ color: 'var(--info)' }} />}
        title="Betroffene Aufträge"
        subtitle="Aufträge mit Material- oder Bad-Abhängigkeit"
        accentBg="linear-gradient(180deg, var(--infobg), transparent)"
        hero={{
          kicker: "Welche Aufträge sind betroffen",
          value: "3 Aufträge",
          changePill: { text: "1 mit hohem Risiko", variant: "red" },
          meta: "Bereich Vergolden · Goldbad-Kapazität begrenzt",
        }}
        composition={{
          title: "C · Betroffene Aufträge · 3 Stück",
          rows: [
            { avatar: "M", avatarColor: "#D14F3D", name: "A-2026-0112 — Museum Lenzburg", meta: "Vergolden, 120 Teile · Frist 20.06. · Risiko: Hoch — Goldbad-Kapazität ab 18.06. erschöpft", amount: "" },
            { avatar: "U", avatarColor: "#FBBF24", name: "A-2026-0115 — Uhren Keller", meta: "Vergolden, 45 Teile · Frist 25.06. · Risiko: Mittel — abhängig von A-0112", amount: "" },
            { avatar: "S", avatarColor: "#34D399", name: "A-2026-0118 — Schlosserei Brunner", meta: "Vergolden, 80 Teile · Frist 30.06. · Risiko: Niedrig — kann auf nächste Charge warten", amount: "" },
          ],
        }}
        insight={{
          body: "<b>Beobachtung:</b> A-2026-0112 (Museum Lenzburg) hat das höchste Risiko — Goldbad-Kapazität ab 18.06. erschöpft. Die beiden Folgeaufträge hängen davon ab.<br><b>Empfehlung:</b> Priorität auf A-0112 setzen. Goldnachkauf prüfen oder Bad-Laufzeit optimieren.",
          actions: [
            { label: "A-0112 priorisieren" },
            { label: "Goldreserve prüfen" },
          ],
        }}
        linkedAreas={[
          { label: "Auftragsbuch", href: "/orders" },
          { label: "Warendurchlauf", href: "/warendurchlauf" },
        ]}
      />
    </PerformanceDetailLayout>
  );
}

