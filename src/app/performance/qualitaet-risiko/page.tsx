"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ShieldCheck, ArrowRight, AlertCircle, Activity, MessageCircle, Shield } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

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

        {/* Module Links */}
        <div className="pd-module-links">
          <Link href="/kundenservice" className="pd-module-link">Kundenservice <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/kommunikation" className="pd-module-link">Kommunikation <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/kontrolle" className="pd-module-link">Qualitätskontrolle <ArrowRight className="w-3 h-3" /></Link>
          <Link href="/orders" className="pd-module-link">Auftragsbuch <ArrowRight className="w-3 h-3" /></Link>
        </div>
      </div>

      {/* OVERLAYS */}
      <DetailOverlay open={overlay === 'reklamation'} onClose={() => setOverlay(null)} title="Reklamationsquote — Trendanalyse">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Verlauf der Reklamationsquote über die letzten 4 Monate:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ m: 'Feb', v: 3.2, c: 'var(--pos)' }, { m: 'Mär', v: 4.1, c: 'var(--pos)' }, { m: 'Apr', v: 5.8, c: 'var(--warn)' }, { m: 'Mai', v: 7.1, c: 'var(--neg)' }].map(r => (
              <div key={r.m} className="pd-bar-row">
                <div className="pd-bar-label">{r.m}</div>
                <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: `${r.v * 10}%`, background: r.c }} /></div>
                <div className="pd-bar-val" style={{ color: r.c }}>{r.v}%</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--negbg)', borderRadius: 10, fontSize: 12, lineHeight: 1.6 }}>
            <strong>Tendenz:</strong> Steigend. Hauptursache ist die Verschlechterung des Nickelbads und fehlende Kalibrierung der Poliermaschine.
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'ursachen'} onClose={() => setOverlay(null)} title="Ursachenverteilung — Detail">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Detaillierte Aufschlüsselung nach Fehlerart:</p>
          {[
            { typ: 'Pickelbildung', anteil: 45, station: 'Galvanik-Zink (Bad 2)', ursache: 'Verunreinigte Badchemie', loesung: 'Neue Filter bestellt' },
            { typ: 'Maßabweichung', anteil: 30, station: 'Politur manuell', ursache: 'Kalibrierfehler', loesung: 'Kalibrierung geplant' },
            { typ: 'Kratzer', anteil: 25, station: 'Schleifen', ursache: 'Schleifscheibe verschlissen', loesung: 'Austausch am Wochenende' },
          ].map(u => (
            <div key={u.typ} style={{ padding: 12, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{u.typ}</span>
                <span style={{ fontWeight: 700, color: 'var(--warn)' }}>{u.anteil}%</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.5 }}>
                <p><strong>Station:</strong> {u.station}</p>
                <p><strong>Ursache:</strong> {u.ursache}</p>
                <p style={{ color: 'var(--pos)' }}><strong>Lösung:</strong> {u.loesung}</p>
              </div>
            </div>
          ))}
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'nacharbeit'} onClose={() => setOverlay(null)} title="Nacharbeitskosten">
        <div style={{ color: 'var(--ink)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--warn)' }}>420 €</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)' }}>Durchschnitt pro Woche</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 12 }}>
            Die Nacharbeitskosten setzen sich zusammen aus Materialverbrauch für Neuanfertigung, verlorener Arbeitszeit und Express-Zuschlägen bei verspäteter Lieferung.
          </p>
          <div style={{ padding: 12, background: 'var(--infobg)', borderRadius: 10, fontSize: 12 }}>
            <strong>Hochrechnung Mai:</strong> ~1.680 € Nacharbeitskosten gesamt. Das entspricht 4% des Monats-Deckungsbeitrags.
          </div>
        </div>
      </DetailOverlay>

      <DetailOverlay open={overlay === 'praevention'} onClose={() => setOverlay(null)} title="Präventionsmaßnahmen — Übersicht">
        <div style={{ color: 'var(--ink)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>Laufende und geplante Maßnahmen zur Senkung der Fehlerquote:</p>
          {[
            { status: 'Bestellt', aktion: 'Neue Bad-Filter für Galvanik-Zink', termin: '12.06.2026', nutzen: 'Senkung Pickelbildung um ~60%' },
            { status: 'Geplant', aktion: 'Kalibrierung Poliermaschine', termin: 'KW24 (Sa)', nutzen: 'Reduktion Maßabweichungen' },
            { status: 'Umgesetzt', aktion: 'Eingangskontrolle-Checkliste aktualisiert', termin: 'Erledigt', nutzen: 'Früheres Erkennen fehlerhafter Zulieferteile' },
            { status: 'Geplant', aktion: 'Schulung Schleifpersonal', termin: 'KW25', nutzen: 'Weniger Kratzer durch bessere Technik' },
          ].map((m, i) => (
            <div key={i} style={{ padding: 12, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{m.aktion}</span>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 700, background: m.status === 'Umgesetzt' ? 'var(--posbg)' : m.status === 'Bestellt' ? 'var(--infobg)' : 'var(--warnbg)', color: m.status === 'Umgesetzt' ? 'var(--pos)' : m.status === 'Bestellt' ? 'var(--info)' : 'var(--warn)' }}>{m.status}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.5 }}>
                <p><strong>Termin:</strong> {m.termin}</p>
                <p style={{ color: 'var(--pos)' }}><strong>Erwarteter Nutzen:</strong> {m.nutzen}</p>
              </div>
            </div>
          ))}
        </div>
      </DetailOverlay>
    </PerformanceDetailLayout>
  );
}
