"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, AlertTriangle, Target, TrendingDown, HeartHandshake, Zap, Shield } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';

export default function KiEmpfehlungenDetail() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded(expanded === id ? null : id);

  const recommendations = [
    {
      id: 'r1',
      icon: <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warn)' }} />,
      iconBg: 'var(--warnbg)',
      prio: 'Hoch',
      prioColor: 'var(--neg)',
      titel: 'Nickelbad-Wartung sofort vorziehen',
      kurz: 'Ausschussquote beim Vernickeln um 2% gestiegen.',
      signal: 'Abfall der PH-Werte in Schicht 2 gemeldet. PH aktuell 6,3 (Grenzwert: 6,5).',
      ursache: 'Dosieranlage filtert nicht optimal. Filtermedium verbraucht.',
      bereich: 'Galvanik, Station 4 (Nickelbad 1)',
      massnahme: 'Wartung dieses Wochenende durchführen. Neue Filter sind bereits bestellt (Eintreffen 12.06.).',
      nutzen: 'Senkung der Ausschussquote auf unter 1%, Vermeidung von Komplettausfall und Produktionsstopp.',
      link: '/baeder',
      linkLabel: 'Bäder-Management',
      link2: '/kontrolle',
      linkLabel2: 'Qualitätskontrolle',
    },
    {
      id: 'r2',
      icon: <Target className="w-5 h-5" style={{ color: 'var(--pos)' }} />,
      iconBg: 'var(--posbg)',
      prio: 'Mittel',
      prioColor: 'var(--warn)',
      titel: 'Express-Kapazität in Vorbereitung freigeben',
      kurz: 'Vorarbeit (Schleifen) ist aktuell unterausgelastet (41%).',
      signal: 'Maschinenstillstand 18% über Normalmaß in Station 1. Grund: Großkunde hat Lieferung um 2 Tage verzögert.',
      ursache: 'Temporäre Unterauslastung durch externe Verzögerung.',
      bereich: 'Vorbereitung / Schleiferei',
      massnahme: '15% Express-Kontingent freigeben und ausgewählte Stammkunden aktiv über Express-Möglichkeit informieren.',
      nutzen: 'Zusätzlicher Umsatz durch Express-Zuschläge (+800 € / Tag). Bessere Maschinennutzung.',
      link: '/warendurchlauf',
      linkLabel: 'Warendurchlauf',
      link2: '/orders',
      linkLabel2: 'Auftragsbuch',
    },
    {
      id: 'r3',
      icon: <TrendingDown className="w-5 h-5" style={{ color: 'var(--info)' }} />,
      iconBg: 'var(--infobg)',
      prio: 'Mittel',
      prioColor: 'var(--warn)',
      titel: 'Gold-Einkauf pausieren',
      kurz: 'Gold-Tagespreis auf Jahreshoch (68,40 €/g).',
      signal: 'Goldpreis überschreitet Warnschwelle von 68 €/g. Einkaufspreis beim letzten Kauf: 60 €/g.',
      ursache: 'Globale Marktschwankungen. Geopolitische Unsicherheiten treiben den Preis.',
      bereich: 'Einkauf / Materiallager',
      massnahme: 'Keine neuen Gold-Vorräte einkaufen. Aktueller Bestand reicht für 14 Arbeitstage. Tagespreis täglich beobachten.',
      nutzen: 'Vermeidung von Margenverlusten bei erwarteter Preiskorrektur nächste Woche. Einsparung ca. 400–800 €.',
      link: '/items',
      linkLabel: 'Material-Lager',
    },
    {
      id: 'r4',
      icon: <HeartHandshake className="w-5 h-5" style={{ color: 'var(--purple)' }} />,
      iconBg: 'var(--purpbg)',
      prio: 'Hoch',
      prioColor: 'var(--neg)',
      titel: 'Kundenbetreuung: Autohaus Berger priorisieren',
      kurz: 'Wichtiger Kunde droht abzuwandern (CLV: 11.800 €).',
      signal: '2 Reklamationen in Folge (KW20 und KW21). Antwortzeit über 48 Stunden.',
      ursache: 'Urlaubsbedingter Engpass im Kundenservice. Keine Vertretung eingerichtet.',
      bereich: 'Kundenservice / Kommunikation',
      massnahme: 'Persönlichen Rückruf durch Geschäftsführung planen. Gutschrift oder Preisnachlass für nächsten Auftrag anbieten.',
      nutzen: 'Rettung eines Top-5 Kunden mit einem CLV von 11.800 €. Vermeidung negativer Mundpropaganda.',
      link: '/kommunikation',
      linkLabel: 'Kommunikations-Center',
      link2: '/customers',
      linkLabel2: 'Kundenkartei',
    },
    {
      id: 'r5',
      icon: <Zap className="w-5 h-5" style={{ color: 'var(--pos)' }} />,
      iconBg: 'var(--posbg)',
      prio: 'Niedrig',
      prioColor: 'var(--pos)',
      titel: '2. Schicht Schleifen aktivieren',
      kurz: 'Engpassstation Schleifen bei 94% Auslastung, 14 Aufträge im Stau.',
      signal: 'Termintreue fällt seit 4 Wochen (aktuell 76%). Stau konzentriert sich auf Schleiferei.',
      ursache: 'Erhöhter Anteil Sonderbearbeitungen und 1 Maschine seit Montag in Wartung.',
      bereich: 'Schleifen / Werkstatt',
      massnahme: '2. Schicht für Donnerstag und Freitag aktivieren. Alternativ: Überstundenregelung mit Schichtleiter abstimmen.',
      nutzen: 'Reduktion des Staus um ca. 50%. Termintreue steigt voraussichtlich um +5 Punkte auf 81%.',
      link: '/warendurchlauf',
      linkLabel: 'Warendurchlauf',
    },
    {
      id: 'r6',
      icon: <Shield className="w-5 h-5" style={{ color: 'var(--cyan)' }} />,
      iconBg: 'rgba(34,211,238,0.12)',
      prio: 'Info',
      prioColor: 'var(--info)',
      titel: 'Politur-Kalibrierung einplanen',
      kurz: 'Maßabweichungen bei 30% der Reklamationen.',
      signal: 'Die letzte Kalibrierung der Poliermaschine liegt 6 Wochen zurück (empfohlen: 4 Wochen).',
      ursache: 'Verzögerung durch Abwesenheit des Maschinentechnikers.',
      bereich: 'Politur / Qualitätskontrolle',
      massnahme: 'Kalibrierung auf Samstag KW24 einplanen, um Produktionsstillstand zu vermeiden.',
      nutzen: 'Reduktion der Maßabweichungen, Senkung der Nacharbeitskosten um ca. 200 € / Woche.',
      link: '/kontrolle',
      linkLabel: 'Qualitätskontrolle',
    },
  ];

  return (
    <PerformanceDetailLayout
      title="KI-Empfehlungen"
      subtitle="Konkrete Verbesserungsvorschläge basierend auf aktuellen Betriebsdaten. Kein Fake-Live-Feed — alle Empfehlungen basieren auf den dargestellten Demo-Daten."
      icon={<Sparkles className="w-6 h-6" style={{ color: '#fff' }} />}
      accentColor="rgba(52,211,153,0.18)"
      pill={{ label: `${recommendations.length} EMPFEHLUNGEN`, variant: 'green' }}
    >
      <div style={{ padding: '12px 16px', background: 'var(--sf2)', borderRadius: 12, border: '1px solid var(--bd)', marginBottom: 20, fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--ink)' }}>Hinweis:</strong> Die nachfolgenden Empfehlungen werden aus den dargestellten Demo-Kennzahlen abgeleitet. In der Produktivversion würde hier eine echte Analyse auf Basis von Echtzeit-Betriebsdaten erfolgen. Derzeit sind alle Vorschläge konzeptionell vorbereitet.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {recommendations.map((r, i) => (
          <div key={r.id} style={{ background: 'var(--sf)', border: `1px solid ${expanded === r.id ? 'var(--bd2)' : 'var(--bd)'}`, borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.3s', boxShadow: expanded === r.id ? '0 8px 24px rgba(0,0,0,0.15)' : 'none' }}>
            {/* Header — always visible */}
            <div onClick={() => toggle(r.id)} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: r.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {r.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `color-mix(in srgb, ${r.prioColor} 15%, transparent)`, color: r.prioColor, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{r.prio}</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{i + 1}. {r.titel}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.4 }}>{r.kurz}</div>
              </div>
              <div style={{ fontSize: 18, color: 'var(--ink3)', transform: expanded === r.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, marginTop: 4 }}>▼</div>
            </div>

            {/* Expanded detail */}
            {expanded === r.id && (
              <div style={{ padding: '0 20px 20px', animation: 'pdFadeIn 0.3s ease' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div style={{ padding: 12, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink3)', letterSpacing: '0.4px', marginBottom: 4 }}>Signal</div>
                    <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{r.signal}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink3)', letterSpacing: '0.4px', marginBottom: 4 }}>Ursache</div>
                    <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{r.ursache}</div>
                  </div>
                </div>

                <div style={{ padding: 12, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink3)', letterSpacing: '0.4px', marginBottom: 4 }}>Betroffener Bereich</div>
                  <div style={{ fontSize: 12, color: 'var(--ink)' }}>{r.bereich}</div>
                </div>

                <div style={{ padding: 12, background: 'var(--sf2)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink3)', letterSpacing: '0.4px', marginBottom: 4 }}>Konkrete Maßnahme</div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{r.massnahme}</div>
                </div>

                <div style={{ padding: 12, background: 'var(--posbg)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--pos)', letterSpacing: '0.4px', marginBottom: 4 }}>Erwarteter Nutzen</div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{r.nutzen}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link href={r.link} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--sf)', color: 'var(--ink2)', fontSize: 12, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}>
                    {r.linkLabel} <ArrowRight className="w-3 h-3" />
                  </Link>
                  {r.link2 && (
                    <Link href={r.link2} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--sf)', color: 'var(--ink2)', fontSize: 12, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}>
                      {r.linkLabel2} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </PerformanceDetailLayout>
  );
}
