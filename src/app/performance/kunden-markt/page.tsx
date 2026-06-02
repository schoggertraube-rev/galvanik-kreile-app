"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, ArrowRight, HeartHandshake, Map, Banknote, Truck, Globe, UserCheck } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

export default function KundenMarktDetail() {
  const [overlay, setOverlay] = useState<string | null>(null);

  return (
    <PerformanceDetailLayout
      title="Kunden und Markt"
      subtitle="Top-Kunden, CLV, Zahlungsmoral, Versandarten, Regionen und Kundentypen — der Blick auf die Kundenbasis."
      icon={<Users className="w-6 h-6" style={{ color: '#fff' }} />}
      accentColor="rgba(96,165,250,0.18)"
      pill={{ label: 'STABIL', variant: 'green' }}
    >
      <div className="pd-grid">

        {/* Top-Kunden → /customers */}
        <Link href="/customers" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
                <UserCheck className="w-5 h-5" style={{ color: 'var(--info)' }} />
              </div>
              <div className="pd-tile-name">Top-Kunden</div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { name: 'Museum Lenzburg', val: '5.840 €', pct: 100 },
                { name: 'Schrauben Meier', val: '4.200 €', pct: 72 },
                { name: 'Autohaus Berger', val: '3.800 €', pct: 65 },
                { name: 'Schlosserei Brunner', val: '2.600 €', pct: 45 },
                { name: 'Uhren Keller', val: '1.900 €', pct: 33 },
              ].map(k => (
                <div key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ width: 110, fontWeight: 500, flexShrink: 0 }}>{k.name}</span>
                  <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: `${k.pct}%`, background: 'var(--info)' }} /></div>
                  <span style={{ fontWeight: 600, width: 54, textAlign: 'right', flexShrink: 0 }}>{k.val}</span>
                </div>
              ))}
            </div>
            <div className="pd-tile-foot">Zur Kundenkartei <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* CLV */}
        <div className="pd-tile" onClick={() => setOverlay('clv')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <HeartHandshake className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Customer Lifetime Value</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--pos)' }}>18.400 €</div>
          <div className="pd-tile-desc">Höchster CLV: Museum Lenzburg · 82% Stammkunden</div>
          <div className="pd-stack" style={{ marginTop: 12 }}>
            <div className="pd-stack-seg" style={{ width: '82%', background: 'var(--pos)' }}>Stammkunden 82%</div>
            <div className="pd-stack-seg" style={{ width: '18%', background: 'var(--warn)' }}>Neukunden 18%</div>
          </div>
          <div className="pd-tile-foot">CLV-Analyse <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Zahlungsmoral */}
        <div className="pd-tile" onClick={() => setOverlay('zahlungsmoral')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <Banknote className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Zahlungsmoral</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--pos)' }}>Ø 18 Tage</div>
          <div className="pd-tile-desc">82% pünktlich · Vorjahr: Ø 22 Tage · Tendenz: Sehr gut</div>
          <div className="pd-mini-bars">
            <div className="pd-mini-bar" style={{ background: 'var(--warn)', height: '80%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '65%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '55%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '50%' }} />
          </div>
          <div className="pd-mini-bar-labels"><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span></div>
          <div style={{ fontSize: 9, color: 'var(--ink3)', textAlign: 'center', marginTop: 2 }}>Ø Zahlungsziel in Tagen (sinkend = besser)</div>
          <div className="pd-tile-foot">Trend ansehen <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Zahlungsarten */}
        <div className="pd-tile" onClick={() => setOverlay('zahlungsarten')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--purpbg)' }}>
              <Banknote className="w-5 h-5" style={{ color: 'var(--purple)' }} />
            </div>
            <div className="pd-tile-name">Zahlungsarten</div>
          </div>
          <div className="pd-stack" style={{ marginTop: 12 }}>
            <div className="pd-stack-seg" style={{ width: '55%', background: 'var(--info)' }}>Überweisung 55%</div>
            <div className="pd-stack-seg" style={{ width: '25%', background: 'var(--pos)' }}>Bar 25%</div>
            <div className="pd-stack-seg" style={{ width: '20%', background: 'var(--purple)' }}>Sonstige 20%</div>
          </div>
          <div className="pd-tile-desc" style={{ marginTop: 8 }}>Überweisung dominiert, Bar-Anteil bei Kleinaufträgen</div>
          <div className="pd-tile-foot">Details <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Abholung / Versand */}
        <div className="pd-tile" onClick={() => setOverlay('logistik')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <Truck className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Abholung und Versand</div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <div style={{ flex: 82, height: 8, background: 'var(--pos)', borderRadius: 4 }} />
            <div style={{ flex: 18, height: 8, background: 'var(--info)', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between', marginTop: 4, color: 'var(--ink2)' }}>
            <span>🚗 Abholung (82%)</span>
            <span>📦 Versand (18%)</span>
          </div>
          <div className="pd-tile-foot">Split-Analyse <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Regionen */}
        <div className="pd-tile" onClick={() => setOverlay('regionen')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
              <Globe className="w-5 h-5" style={{ color: 'var(--info)' }} />
            </div>
            <div className="pd-tile-name">Regionen</div>
          </div>
          <div className="pd-stack" style={{ marginTop: 12 }}>
            <div className="pd-stack-seg" style={{ width: '60%', background: 'var(--info)' }}>CH 60%</div>
            <div className="pd-stack-seg" style={{ width: '25%', background: 'var(--pos)' }}>DE 25%</div>
            <div className="pd-stack-seg" style={{ width: '10%', background: 'var(--purple)' }}>AT 10%</div>
            <div className="pd-stack-seg" style={{ width: '5%', background: 'var(--ink3)' }}>EU</div>
          </div>
          <div className="pd-tile-desc" style={{ marginTop: 8 }}>3 Länder aktiv · DACH-Fokus (95%)</div>
          <div className="pd-tile-foot">Geo-Verteilung <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Kundentypen */}
        <div className="pd-tile" onClick={() => setOverlay('kundentypen')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--warnbg)' }}>
              <Users className="w-5 h-5" style={{ color: 'var(--warn)' }} />
            </div>
            <div className="pd-tile-name">Kundentypen</div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="pd-bar-row">
              <div className="pd-bar-label">B2B Industrie</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '60%', background: 'var(--info)' }} /></div>
              <div className="pd-bar-val">60%</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">B2B Handwerk</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '30%', background: 'var(--pos)' }} /></div>
              <div className="pd-bar-val">30%</div>
            </div>
            <div className="pd-bar-row">
              <div className="pd-bar-label">B2C Privat</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '10%', background: 'var(--purple)' }} /></div>
              <div className="pd-bar-val">10%</div>
            </div>
          </div>
          <div className="pd-tile-foot">Verteilung <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Kundenrisiko → /kommunikation */}
        <Link href="/kommunikation" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--negbg)' }}>
                <HeartHandshake className="w-5 h-5" style={{ color: 'var(--neg)' }} />
              </div>
              <div className="pd-tile-name">Kundenrisiko</div>
            </div>
            <div className="pd-tile-val" style={{ color: 'var(--neg)' }}>1</div>
            <div className="pd-tile-desc">Großkunde droht abzuwandern (Lieferverzug bei Charge 409)</div>
            <div style={{ marginTop: 10, padding: 10, background: 'var(--negbg)', borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}>
              <strong>Autohaus Berger</strong> — 2 Reklamationen in Folge, Antwortzeit über 48h
            </div>
            <div className="pd-tile-foot">Zur Kommunikation <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Module Links */}
        <div className="pd-module-links">
          <Link href="/customers" className="pd-module-link">Kundenkartei <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/kommunikation" className="pd-module-link">Kommunikation <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/finanzen" className="pd-module-link">Finanzen <ArrowRight className="w-3 h-3" /></Link>
        </div>
      </div>

      {/* OVERLAYS */}
      <DetailOverlay open={overlay === 'clv'} onClose={() => setOverlay(null)} title="Customer Lifetime Value">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>CLV-Ranking der Top-5-Kunden basierend auf historischem Auftragsvolumen:</p>
          {[
            { name: 'Museum Lenzburg', clv: '18.400 €', seit: '2019', auftraege: 42 },
            { name: 'Schrauben Meier', clv: '14.200 €', seit: '2020', auftraege: 35 },
            { name: 'Autohaus Berger', clv: '11.800 €', seit: '2021', auftraege: 28 },
            { name: 'Schlosserei Brunner', clv: '9.600 €', seit: '2022', auftraege: 19 },
            { name: 'Uhren Keller', clv: '7.200 €', seit: '2023', auftraege: 12 },
          ].map((k, i) => (
            <div key={k.name} style={{ padding: 10, background: 'var(--sf2)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <div><span style={{ fontWeight: 700, color: 'var(--info)', marginRight: 6 }}>{i + 1}.</span><span style={{ fontWeight: 600 }}>{k.name}</span></div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', color: 'var(--ink2)', fontSize: 11 }}>
                <span>seit {k.seit}</span><span>{k.auftraege} Aufträge</span><span style={{ fontWeight: 700, color: 'var(--pos)' }}>{k.clv}</span>
              </div>
            </div>
          ))}
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'zahlungsmoral'} onClose={() => setOverlay(null)} title="Zahlungsmoral — Trend">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--pos)' }}>Ø 18 Tage</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)' }}>Durchschnittliches Zahlungsziel (Vorjahr: 22 T)</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>82% der Rechnungen werden pünktlich bezahlt. Der Trend ist positiv: Das Zahlungsziel hat sich in den letzten 4 Quartalen kontinuierlich verkürzt. Keine Forderungsausfälle im aktuellen Quartal.</p>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'zahlungsarten'} onClose={() => setOverlay(null)} title="Zahlungsarten — Verteilung">
        <div style={{ color: 'var(--ink)' }}>
          {[
            { art: 'Überweisung', anteil: 55, hinweis: 'Hauptzahlungsweg für B2B-Kunden' },
            { art: 'Barzahlung', anteil: 25, hinweis: 'Überwiegend bei Abholung von Kleinaufträgen' },
            { art: 'EC / Karte', anteil: 12, hinweis: 'Zunehmend bei Privatkunden' },
            { art: 'Sonstige', anteil: 8, hinweis: 'Darunter Vorkasse und Nachnahme' },
          ].map(z => (
            <div key={z.art} style={{ padding: 12, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{z.art}</span>
                <span style={{ fontWeight: 700, color: 'var(--info)' }}>{z.anteil}%</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{z.hinweis}</div>
            </div>
          ))}
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'logistik'} onClose={() => setOverlay(null)} title="Abholung und Versand">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 20 }}>
            <div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--pos)' }}>82%</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Abholung vor Ort</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--info)' }}>18%</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Versand</div></div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>Die hohe Abholquote reduziert Versandkosten und Transportrisiken erheblich. Versandkunden befinden sich überwiegend in DE und AT.</p>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'regionen'} onClose={() => setOverlay(null)} title="Geo-Verteilung">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Verteilung nach Herkunftsland der Kunden:</p>
          {[
            { land: 'Schweiz', anteil: 60, kunden: 28 },
            { land: 'Deutschland', anteil: 25, kunden: 12 },
            { land: 'Österreich', anteil: 10, kunden: 5 },
            { land: 'Rest-EU', anteil: 5, kunden: 2 },
          ].map(r => (
            <div key={r.land} className="pd-bar-row" style={{ marginBottom: 8 }}>
              <div className="pd-bar-label">{r.land}</div>
              <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: `${r.anteil}%`, background: 'var(--info)' }} /></div>
              <div className="pd-bar-val">{r.anteil}%</div>
            </div>
          ))}
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'kundentypen'} onClose={() => setOverlay(null)} title="Kundentypen — B2B/B2C-Split">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 20 }}>
            <div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--info)' }}>60%</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>B2B Industrie</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--pos)' }}>30%</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>B2B Handwerk</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 800, color: 'var(--purple)' }}>10%</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>B2C Privat</div></div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>Industriekunden liefern das höchste Volumen pro Auftrag. Handwerkskunden sind loyaler (Wiederholungsrate 92%). Privatkunden haben den höchsten Express-Anteil.</p>
        </div>
      </DetailOverlay>
    </PerformanceDetailLayout>
  );
}
