"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Banknote, TrendingUp, ArrowRight, Target, BarChart3, Users, Zap, Calculator } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

export default function UmsatzMargeDetail() {
  const [overlay, setOverlay] = useState<string | null>(null);

  return (
    <PerformanceDetailLayout
      title="Umsatz und Marge"
      subtitle="Umsatzentwicklung, Deckungsbeitrag, Kostenstruktur und Forecast — die finanzielle Gesundheit des Betriebs."
      icon={<Banknote className="w-6 h-6" style={{ color: '#fff' }} />}
      accentColor="rgba(52,211,153,0.18)"
      pill={{ label: 'STABIL', variant: 'green' }}
    >
      <div className="pd-grid">

        {/* Umsatz netto */}
        <div className="pd-tile" onClick={() => setOverlay('umsatz')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <Banknote className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Umsatz netto</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--pos)' }}>42.380 €</div>
          <div className="pd-tile-desc">▲ +7,2% vs. Vorjahr · laufender Monat</div>
          <div className="pd-sparkline">
            <svg viewBox="0 0 140 28" width="140" height="28">
              <defs><linearGradient id="usg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--pos)" stopOpacity="0.22" /><stop offset="100%" stopColor="var(--pos)" stopOpacity="0" /></linearGradient></defs>
              <path d="M0,22 L16,19 L32,20 L48,16 L64,14 L80,13 L96,11 L112,10 L128,7 L140,5 L140,28 L0,28 Z" fill="url(#usg)" />
              <polyline points="0,22 16,19 32,20 48,16 64,14 80,13 96,11 112,10 128,7 140,5" fill="none" stroke="var(--pos)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="pd-tile-foot">Monatsübersicht <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Deckungsbeitrag */}
        <div className="pd-tile" onClick={() => setOverlay('db')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
              <BarChart3 className="w-5 h-5" style={{ color: 'var(--info)' }} />
            </div>
            <div className="pd-tile-name">Deckungsbeitrag</div>
          </div>
          <div className="pd-tile-val">11.840 €</div>
          <div className="pd-tile-desc">27,9% Marge · nach variablen Kosten</div>
          <div className="pd-stack" style={{ marginTop: 12 }}>
            <div className="pd-stack-seg" style={{ width: '72%', background: 'var(--info)' }}>Kosten 72%</div>
            <div className="pd-stack-seg" style={{ width: '28%', background: 'var(--pos)' }}>Marge 28%</div>
          </div>
          <div className="pd-tile-foot">Margenanalyse <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Gewinn grob */}
        <div className="pd-tile" onClick={() => setOverlay('gewinn')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--posbg)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: 'var(--pos)' }} />
            </div>
            <div className="pd-tile-name">Gewinn grob</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--pos)' }}>8.200 €</div>
          <div className="pd-tile-desc">Erlöse minus alle erfassten Kosten</div>
          <div className="pd-mini-bars">
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '60%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '68%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '72%' }} />
            <div className="pd-mini-bar" style={{ background: 'var(--pos)', height: '85%' }} />
          </div>
          <div className="pd-mini-bar-labels"><span>Jan</span><span>Feb</span><span>Mär</span><span>Apr</span></div>
          <div className="pd-tile-foot">Erlöse vs. Kosten <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Fixkosten → /finanzen */}
        <Link href="/finanzen" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
                <Calculator className="w-5 h-5" style={{ color: 'var(--info)' }} />
              </div>
              <div className="pd-tile-name">Fixkosten</div>
            </div>
            <div className="pd-tile-val" style={{ color: 'var(--info)' }}>18.500 €</div>
            <div className="pd-tile-desc">Miete, Personal, Abschreibungen, Versicherungen</div>
            <div className="pd-stack" style={{ marginTop: 12 }}>
              <div className="pd-stack-seg" style={{ width: '45%', background: 'var(--info)' }}>Personal</div>
              <div className="pd-stack-seg" style={{ width: '25%', background: 'var(--purple)' }}>Miete</div>
              <div className="pd-stack-seg" style={{ width: '20%', background: 'var(--warn)' }}>AfA</div>
              <div className="pd-stack-seg" style={{ width: '10%', background: 'var(--ink3)' }}>Sonst.</div>
            </div>
            <div className="pd-tile-foot">Zu den Finanzen <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Variable Kosten → /finanzen */}
        <Link href="/finanzen" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--warnbg)' }}>
                <Zap className="w-5 h-5" style={{ color: 'var(--warn)' }} />
              </div>
              <div className="pd-tile-name">Variable Kosten</div>
            </div>
            <div className="pd-tile-val" style={{ color: 'var(--warn)' }}>12.040 €</div>
            <div className="pd-tile-desc">Energie, Material, Chemie, Versand</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div className="pd-bar-row">
                <div className="pd-bar-label">Energie</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '40%', background: 'var(--warn)' }} /></div>
                <div className="pd-bar-val">4.820 €</div>
              </div>
              <div className="pd-bar-row">
                <div className="pd-bar-label">Material</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '30%', background: 'var(--info)' }} /></div>
                <div className="pd-bar-val">3.610 €</div>
              </div>
              <div className="pd-bar-row">
                <div className="pd-bar-label">Chemie</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '20%', background: 'var(--purple)' }} /></div>
                <div className="pd-bar-val">2.410 €</div>
              </div>
              <div className="pd-bar-row">
                <div className="pd-bar-label">Versand</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: '10%', background: 'var(--pos)' }} /></div>
                <div className="pd-bar-val">1.200 €</div>
              </div>
            </div>
            <div className="pd-tile-foot">Zu den Finanzen <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Forecast Monatsende */}
        <div className="pd-tile" onClick={() => setOverlay('forecast')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--purpbg)' }}>
              <Target className="w-5 h-5" style={{ color: 'var(--purple)' }} />
            </div>
            <div className="pd-tile-name">Forecast Monatsende</div>
          </div>
          <div className="pd-tile-val" style={{ color: 'var(--purple)' }}>~145.000 €</div>
          <div className="pd-tile-desc">Hochrechnung basierend auf aktuellem Auftragseingang</div>
          <div style={{ marginTop: 10, position: 'relative', height: 40 }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed var(--ink3)' }} />
            <svg viewBox="0 0 200 40" width="100%" height="40" preserveAspectRatio="none">
              <polyline points="0,35 30,30 60,28 90,22 120,18 150,12 180,8 200,5" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="150,12 180,10 200,8" fill="none" stroke="var(--purple)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 9, color: 'var(--ink3)', textAlign: 'center' }}>Kumuliert · gestrichelt = Prognose</div>
          <div className="pd-tile-foot">Szenario ansehen <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Stärkste Kunden → /customers */}
        <Link href="/customers" className="pd-link">
          <div className="pd-tile">
            <div className="pd-tile-hd">
              <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
                <Users className="w-5 h-5" style={{ color: 'var(--info)' }} />
              </div>
              <div className="pd-tile-name">Stärkste Kunden</div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { name: 'Museum Lenzburg', val: '18.400 €', pct: 100 },
                { name: 'Schrauben Meier', val: '12.200 €', pct: 66 },
                { name: 'Autohaus Berger', val: '8.600 €', pct: 47 },
                { name: 'Schlosserei Brunner', val: '6.400 €', pct: 35 },
              ].map(k => (
                <div key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ width: 110, fontWeight: 500, flexShrink: 0 }}>{k.name}</span>
                  <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: `${k.pct}%`, background: 'var(--info)' }} /></div>
                  <span style={{ fontWeight: 600, width: 60, textAlign: 'right', flexShrink: 0 }}>{k.val}</span>
                </div>
              ))}
            </div>
            <div className="pd-tile-foot">Zur Kundenkartei <ArrowRight className="w-3 h-3" /></div>
          </div>
        </Link>

        {/* Kalkulationshinweise */}
        <div className="pd-tile" onClick={() => setOverlay('kalkulation')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--warnbg)' }}>
              <Calculator className="w-5 h-5" style={{ color: 'var(--warn)' }} />
            </div>
            <div className="pd-tile-name">Kalkulationshinweise</div>
          </div>
          <div className="pd-tile-desc" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5 }}>
            Energiekosten sind um 2% gesunken, Materialkosten (+1%) fressen dies teilweise auf. Gold-Einkaufspreis hat Warnschwelle überschritten.
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '4px 10px', background: 'var(--posbg)', color: 'var(--pos)', borderRadius: 6, fontWeight: 600 }}>Energie −2%</span>
            <span style={{ fontSize: 10, padding: '4px 10px', background: 'var(--negbg)', color: 'var(--neg)', borderRadius: 6, fontWeight: 600 }}>Material +1%</span>
            <span style={{ fontSize: 10, padding: '4px 10px', background: 'var(--warnbg)', color: 'var(--warn)', borderRadius: 6, fontWeight: 600 }}>Gold: Warnung</span>
          </div>
          <div className="pd-tile-foot">Details ansehen <ArrowRight className="w-3 h-3" /></div>
        </div>

        {/* Module Links */}
        <div className="pd-module-links">
          <Link href="/finanzen" className="pd-module-link">Finanz-Dashboard <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/orders" className="pd-module-link">Auftragsbuch <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/customers" className="pd-module-link">Kundenkartei <ArrowRight className="w-3 h-3" /></Link>
        </div>
      </div>

      {/* OVERLAYS */}
      <DetailOverlay open={overlay === 'umsatz'} onClose={() => setOverlay(null)} title="Umsatz netto — Monatsübersicht">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Kumulierter Nettoumsatz im laufenden Monat, aufgeteilt nach Wochen.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ w: 'KW19', v: 8200 }, { w: 'KW20', v: 10400 }, { w: 'KW21', v: 12600 }, { w: 'KW22', v: 11180 }].map(r => (
              <div key={r.w} className="pd-bar-row">
                <div className="pd-bar-label">{r.w}</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: `${(r.v / 14000) * 100}%`, background: 'var(--pos)' }} /></div>
                <div className="pd-bar-val">{r.v.toLocaleString('de-DE')} €</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--posbg)', borderRadius: 10, fontSize: 12, lineHeight: 1.6 }}>
            <strong>Stärkste Kunden diesen Monat:</strong> Museum Lenzburg (18k €), Schrauben Meier (12k €), Autohaus Berger (8.6k €).
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'db'} onClose={() => setOverlay(null)} title="Deckungsbeitrag — Margenanalyse">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 20 }}>
            <div><div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pos)' }}>27,9%</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Marge aktuell</div></div>
            <div><div style={{ fontSize: 28, fontWeight: 800 }}>11.840 €</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Deckungsbeitrag</div></div>
          </div>
          <div className="pd-stack" style={{ marginBottom: 16 }}>
            <div className="pd-stack-seg" style={{ width: '40%', background: 'var(--info)' }}>Fix 40%</div>
            <div className="pd-stack-seg" style={{ width: '32%', background: 'var(--warn)' }}>Var 32%</div>
            <div className="pd-stack-seg" style={{ width: '28%', background: 'var(--pos)' }}>Marge 28%</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>Die Marge liegt leicht über dem Branchendurchschnitt von 25%. Steigende Goldpreise könnten die Marge ab nächster Woche unter Druck setzen.</p>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'gewinn'} onClose={() => setOverlay(null)} title="Gewinn grob — Erlöse vs. Kosten">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 20 }}>
            <div><div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pos)' }}>42.380 €</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Erlöse</div></div>
            <div><div style={{ fontSize: 28, fontWeight: 800, color: 'var(--neg)' }}>30.540 €</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Kosten gesamt</div></div>
            <div><div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pos)' }}>8.200 €</div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Rohgewinn</div></div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>Hinweis: Der Rohgewinn berücksichtigt keine Sonderkosten (z.B. einmalige Reparaturen) oder ausstehende Rechnungen.</p>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'forecast'} onClose={() => setOverlay(null)} title="Forecast — Hochrechnung Monatsende">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--purple)' }}>~145.000 €</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)' }}>Prognostizierter Monatsumsatz</div>
          </div>
          <div style={{ padding: 12, background: 'var(--purpbg)', borderRadius: 10, fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>
            <strong>Methodik:</strong> Linearer Trend basierend auf den bisherigen 22 Werktagen. Bei 5 verbleibenden Werktagen und aktuellem Auftragsbestand.
          </div>
          <div style={{ padding: 12, background: 'var(--posbg)', borderRadius: 10, fontSize: 12, lineHeight: 1.6 }}>
            <strong>Szenario Optimistisch:</strong> Falls 3 offene Großaufträge bestätigt werden: ~158.000 €
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'kalkulation'} onClose={() => setOverlay(null)} title="Kalkulationshinweise">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Aktuelle Veränderungen der Kostenstruktur und ihre Auswirkungen:</p>
          {[
            { thema: 'Energiekosten', delta: '−2%', impact: 'Einsparung ca. 96 € / Monat durch neue Tarifverhandlung', color: 'var(--pos)' },
            { thema: 'Materialkosten', delta: '+1%', impact: 'Kupfer und Nickel leicht teurer, Gold auf Warnschwelle', color: 'var(--neg)' },
            { thema: 'Personalkosten', delta: '±0%', impact: 'Keine Änderung. Nächste Gehaltsrunde in Q4', color: 'var(--ink2)' },
            { thema: 'Goldpreis-Warnung', delta: '+14%', impact: 'EK-Preis 60 €/g, Tagespreis 68,40 €/g — Marge aktuell positiv, aber Nachkauf riskant', color: 'var(--warn)' },
          ].map((h, i) => (
            <div key={i} style={{ padding: 12, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{h.thema}</span>
                <span style={{ fontWeight: 700, color: h.color }}>{h.delta}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.5 }}>{h.impact}</div>
            </div>
          ))}
        </div>
      </DetailOverlay>
    </PerformanceDetailLayout>
  );
}
