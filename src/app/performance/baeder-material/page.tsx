"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { FlaskConical, ArrowRight, BarChart3, AlertTriangle, Package, Droplets } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

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

        {/* Badstatus → /baeder */}
        <Link href="/baeder" className="pd-link">
          <div className="pd-tile">
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
            <div className="pd-tile-foot">Zum Bäder-Management <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

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

        {/* Chemiebestand → /items */}
        <Link href="/items" className="pd-link">
          <div className="pd-tile">
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
            <div className="pd-tile-foot">Zum Materiallager <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

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

        {/* Betroffene Aufträge → /orders */}
        <Link href="/orders" className="pd-link">
          <div className="pd-tile">
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
            <div className="pd-tile-foot">Zum Auftragsbuch <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Module Links */}
        <div className="pd-module-links">
          <Link href="/baeder" className="pd-module-link">Bäder-Management <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/items" className="pd-module-link">Materiallager <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/finanzen" className="pd-module-link">Finanzen <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/orders" className="pd-module-link">Auftragsbuch <ArrowRight className="w-3 h-3" /></Link>
        </div>
      </div>

      {/* OVERLAYS */}
      <DetailOverlay open={overlay === 'kritisch'} onClose={() => setOverlay(null)} title="Kritische Bäder — Nickelbad 1">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ padding: 12, background: 'var(--warnbg)', borderRadius: 10, marginBottom: 16, fontSize: 12, lineHeight: 1.6 }}>
            <strong>PH-Wert:</strong> 6,3 (Grenzwert: 6,5 · Idealwert: 7,0)<br />
            <strong>Toleranzabweichung:</strong> −0,2 unter Mindest-PH<br />
            <strong>Empfehlung:</strong> Sofortige Nachdosierung und Filterreinigung. Eskalation an Schichtleiter.
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>Bei anhaltendem Absinken droht Beschichtungsausfall und erhöhte Reklamationsquote (Pickelbildung).</p>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'verbrauch'} onClose={() => setOverlay(null)} title="Metallverbrauch — Wochenanalyse">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Verbrauch dieser Woche im Vergleich zur Vorwoche:</p>
          {[
            { m: 'Gold', aktuell: '42g', vorw: '47g', delta: '−5g', c: 'var(--pos)' },
            { m: 'Silber', aktuell: '180g', vorw: '175g', delta: '+5g', c: 'var(--warn)' },
            { m: 'Kupfer', aktuell: '2,4kg', vorw: '2,6kg', delta: '−0,2kg', c: 'var(--pos)' },
            { m: 'Nickel', aktuell: '1,8kg', vorw: '1,9kg', delta: '−0,1kg', c: 'var(--pos)' },
          ].map(v => (
            <div key={v.m} style={{ padding: 10, background: 'var(--sf2)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{v.m}</span>
              <span>Aktuell: {v.aktuell}</span>
              <span style={{ color: 'var(--ink2)' }}>Vorwoche: {v.vorw}</span>
              <span style={{ fontWeight: 700, color: v.c }}>{v.delta}</span>
            </div>
          ))}
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'marge'} onClose={() => setOverlay(null)} title="Metallmarge — Detailanalyse">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--pos)' }}>+2.840 €</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)' }}>Metallmarge laufender Monat</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 12 }}>
            Die Metallmarge ergibt sich aus der Differenz zwischen dem Einkaufspreis zum Zeitpunkt der Beschaffung und dem aktuellen Tagespreis. Ein positiver Wert bedeutet, dass das Metall seit dem Kauf an Wert gewonnen hat.
          </p>
          <div style={{ padding: 12, background: 'var(--warnbg)', borderRadius: 10, fontSize: 12, lineHeight: 1.6 }}>
            <strong>Warnung Gold:</strong> Der Tagespreis ist auf Jahreshoch (68,40 €/g). Ein Nachkauf zu aktuellen Preisen würde die Marge bei fallenden Preisen gefährden.
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'preise'} onClose={() => setOverlay(null)} title="Einkaufspreis vs. Tagespreis">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Vergleich zwischen dem Preis zum Zeitpunkt des Einkaufs und dem aktuellen Marktpreis:</p>
          {[
            { metall: 'Gold', ek: 60.00, tp: 68.40, einheit: '€/g' },
            { metall: 'Silber', ek: 0.95, tp: 0.98, einheit: '€/g' },
            { metall: 'Kupfer', ek: 9.10, tp: 8.78, einheit: '€/kg' },
            { metall: 'Nickel', ek: 15.20, tp: 15.90, einheit: '€/kg' },
          ].map(p => {
            const diff = ((p.tp - p.ek) / p.ek * 100);
            const isPos = diff > 0;
            return (
              <div key={p.metall} style={{ padding: 12, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.metall}</span>
                  <span style={{ fontWeight: 700, color: isPos ? 'var(--pos)' : 'var(--neg)' }}>{isPos ? '+' : ''}{diff.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink2)' }}>
                  <span>Einkauf: {p.ek.toFixed(2)} {p.einheit}</span>
                  <span>Tagespreis: {p.tp.toFixed(2)} {p.einheit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </DetailOverlay>
    </PerformanceDetailLayout>
  );
}
