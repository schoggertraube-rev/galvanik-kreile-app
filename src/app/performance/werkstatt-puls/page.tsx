"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, Clock, Target, AlertOctagon, ArrowRight, Zap, CheckCircle2, TrendingDown } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

export default function WerkstattPulsDetail() {
  const [overlay, setOverlay] = useState<string | null>(null);

  return (
    <PerformanceDetailLayout
      title="Werkstatt-Puls"
      subtitle="Durchsatz, Stationsauslastung, Termintreue und Wochenziel — die operative Herzfrequenz der Galvanik."
      icon={<Activity className="w-6 h-6" style={{ color: '#fff' }} />}
      accentColor="rgba(34,211,238,0.18)"
      pill={{ label: 'HANDLUNGSBEDARF', variant: 'yellow' }}
    >
      <div className="pd-grid">

        {/* Termintreue */}
        <div className="pd-tile" onClick={() => setOverlay('termintreue')} style={{ cursor: 'pointer' }}>
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

        {/* Module Links */}
        <div className="pd-module-links">
          <Link href="/orders" className="pd-module-link">Auftragsbuch <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/warendurchlauf" className="pd-module-link">Warendurchlauf <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/kontrolle" className="pd-module-link">Qualitätskontrolle <ArrowRight className="w-3 h-3" /></Link>
        </div>
      </div>

      {/* OVERLAYS */}
      <DetailOverlay open={overlay === 'termintreue'} onClose={() => setOverlay(null)} title="Termintreue — Trendanalyse">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Die Termintreue ist seit 4 Wochen rückläufig. Hauptgrund: Engpass bei Schleifen und verzögerte Zulieferungen.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ w: 'KW19', v: 85, c: 'var(--pos)' }, { w: 'KW20', v: 82, c: 'var(--pos)' }, { w: 'KW21', v: 79, c: 'var(--warn)' }, { w: 'KW22', v: 76, c: 'var(--neg)' }].map(r => (
              <div key={r.w} className="pd-bar-row">
                <div className="pd-bar-label">{r.w}</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: `${r.v}%`, background: r.c }} /></div>
                <div className="pd-bar-val" style={{ color: r.c }}>{r.v}%</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--negbg)', borderRadius: 10, fontSize: 12 }}>
            <strong>Prognose:</strong> Ohne Gegenmaßnahme sinkt die Termintreue bis Monatsende auf ca. 72%.
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/orders" style={{ padding: '8px 14px', border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--sf)', color: 'var(--ink2)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Auftragsbuch</Link>
            <Link href="/kontrolle" style={{ padding: '8px 14px', border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--sf)', color: 'var(--ink2)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Qualitätskontrolle</Link>
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'durchlaufzeit'} onClose={() => setOverlay(null)} title="Durchlaufzeit — Stationsanalyse">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Mittlere Verweildauer je Station. Schleifen und Politur sind die größten Zeitfresser.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { s: 'Schleifen', t: 2.8, pct: 30, c: 'var(--neg)', hint: 'Engpass: 14 Aufträge im Stau' },
              { s: 'Politur', t: 2.3, pct: 24, c: 'var(--warn)', hint: 'Wartung fällig in 3 Tagen' },
              { s: 'Galvanik', t: 1.9, pct: 20, c: 'var(--pos)', hint: 'Stabil, Nickelbad beobachten' },
              { s: 'Vorbereitung', t: 1.2, pct: 13, c: 'var(--info)', hint: 'Unterausgelastet — Express möglich' },
              { s: 'QK und Versand', t: 1.2, pct: 13, c: 'var(--purple)', hint: 'Stabil' },
            ].map(s => (
              <div key={s.s} style={{ padding: 10, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{s.s}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: s.c }}>{s.t} Tage</span>
                </div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: `${s.pct * 3.3}%`, background: s.c }} /></div>
                <div style={{ fontSize: 10, color: 'var(--ink2)', marginTop: 4 }}>{s.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'engpass'} onClose={() => setOverlay(null)} title="Engpassstation — Schleifen">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ padding: 12, background: 'var(--negbg)', borderRadius: 10, marginBottom: 16, fontSize: 12, lineHeight: 1.6 }}>
            <strong>Ursache:</strong> Erhöhter Anteil an Sonderbearbeitungen und 1 Maschine seit Mo. in Wartung.<br />
            <strong>Folge:</strong> 14 Aufträge stauen sich, 8 davon mit akutem Terminrisiko.<br />
            <strong>Empfehlung:</strong> 2. Schicht für Do/Fr aktivieren oder Express-Aufträge temporär auf Politur umleiten.
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/warendurchlauf" style={{ padding: '8px 14px', border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--sf)', color: 'var(--ink2)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Warendurchlauf</Link>
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'terminrisiko'} onClose={() => setOverlay(null)} title="Terminrisiko-Liste">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Aufträge, deren Liefertermin gefährdet oder bereits überschritten ist.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id: 'A-2026-0089', kunde: 'Museum Lenzburg', wert: '4.200 €', tage: -2, station: 'Schleifen' },
              { id: 'A-2026-0091', kunde: 'Autohaus Berger', wert: '2.800 €', tage: -1, station: 'Politur' },
              { id: 'A-2026-0094', kunde: 'Schlosserei Brunner', wert: '1.600 €', tage: 0, station: 'Galvanik' },
              { id: 'A-2026-0095', kunde: 'Uhren Keller', wert: '3.400 €', tage: 0, station: 'Schleifen' },
              { id: 'A-2026-0098', kunde: 'Metallbau Zürich', wert: '2.200 €', tage: 1, station: 'Vorbereitung' },
              { id: 'A-2026-0101', kunde: 'Privatauftrag K.', wert: '1.100 €', tage: 1, station: 'Galvanik' },
              { id: 'A-2026-0103', kunde: 'Schmuck Lutz', wert: '3.800 €', tage: 2, station: 'Schleifen' },
              { id: 'A-2026-0107', kunde: 'Antiquitäten Bern', wert: '3.300 €', tage: 2, station: 'Politur' },
            ].map(a => (
              <div key={a.id} style={{ padding: 10, background: 'var(--sf2)', borderRadius: 8, border: `1px solid ${a.tage < 0 ? 'var(--neg)' : a.tage === 0 ? 'var(--warn)' : 'var(--bd)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{a.id}</span>
                  <span style={{ color: 'var(--ink2)', marginLeft: 8 }}>{a.kunde}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: 'var(--ink2)', fontSize: 10 }}>{a.station}</span>
                  <span style={{ fontWeight: 600 }}>{a.wert}</span>
                  <span style={{ color: a.tage < 0 ? 'var(--neg)' : a.tage === 0 ? 'var(--warn)' : 'var(--ink2)', fontWeight: 700, fontSize: 11 }}>{a.tage < 0 ? `${a.tage} T` : a.tage === 0 ? 'Heute' : `+${a.tage} T`}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'wochenziel'} onClose={() => setOverlay(null)} title="Wochenziel — Fortschritt">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48, fontWeight: 800 }}>23 <span style={{ fontSize: 20, fontWeight: 400, color: 'var(--ink2)' }}>/ 25</span></div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>Chargen abgeschlossen</div>
          </div>
          <div style={{ height: 12, background: 'var(--bd)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ width: '92%', height: '100%', background: 'linear-gradient(90deg, var(--pos), var(--cyan))', borderRadius: 6 }} />
          </div>
          <div style={{ padding: 12, background: 'var(--posbg)', borderRadius: 10, fontSize: 12, lineHeight: 1.6 }}>
            <strong>Prognose:</strong> Bei aktuellem Tempo werden 25 Chargen bis Freitag 14:00 Uhr erreicht. 2 Express-Chargen könnten das Ziel bereits bis Donnerstag sichern.
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'massnahmen'} onClose={() => setOverlay(null)} title="Maßnahmenvorschläge">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Operative Handlungsempfehlungen für die aktuelle Woche:</p>
          {[
            { prio: 'Hoch', signal: '94% Auslastung Schleifen', aktion: '2. Schicht für Do/Fr aktivieren', nutzen: 'Reduktion des Staus um ca. 50%, Termintreue +5 Pkt.', color: 'var(--neg)', link: '/warendurchlauf', linkLabel: 'Warendurchlauf' },
            { prio: 'Mittel', signal: 'Politur-Wartung überfällig', aktion: 'Wartung auf Samstag vorziehen', nutzen: 'Vermeidung ungeplanter Stillstandzeit nächste Woche', color: 'var(--warn)', link: '/kontrolle', linkLabel: 'Qualitätskontrolle' },
            { prio: 'Niedrig', signal: 'Vorbereitung unterausgelastet', aktion: '15% Express-Kontingent freigeben', nutzen: '+800 € Zusatzumsatz pro Tag durch Express-Zuschläge', color: 'var(--pos)', link: '/orders', linkLabel: 'Auftragsbuch' },
          ].map((m, i) => (
            <div key={i} style={{ padding: 14, background: 'var(--sf2)', borderRadius: 12, border: `1px solid var(--bd)`, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Priorität: {m.prio}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <p><strong>Signal:</strong> {m.signal}</p>
                <p style={{ marginTop: 4 }}><strong>Maßnahme:</strong> {m.aktion}</p>
                <p style={{ marginTop: 4, color: 'var(--pos)' }}><strong>Erwarteter Nutzen:</strong> {m.nutzen}</p>
              </div>
              <div style={{ marginTop: 10 }}>
                <Link href={m.link} style={{ padding: '6px 12px', border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--sf)', color: 'var(--ink2)', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>{m.linkLabel}</Link>
              </div>
            </div>
          ))}
        </div>
      </DetailOverlay>
    </PerformanceDetailLayout>
  );
}
