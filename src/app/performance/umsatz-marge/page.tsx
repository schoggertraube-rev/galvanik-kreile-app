"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import React, { useState } from 'react';
import Link from 'next/link';
import { Banknote, TrendingUp, ArrowRight, Target, BarChart3, Users, Zap, Calculator } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { AnalysisOverlay } from '@/components/ui/AnalysisOverlay';

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
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Performance',href:'/performance'}, {label:'Umsatz-marge'}]} />
        <BackButton label="Performance" href="/performance" />
      </div>
      

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


      </div>

      {/* OVERLAYS — standardized AnalysisOverlay pattern */}
      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'umsatz'} onClose={() => setOverlay(null)} icon={<Banknote className="w-5 h-5" style={{ color: 'var(--pos)' }} />} title="Umsatz netto" subtitle="Kumulierter Nettoumsatz im laufenden Monat" accentBg="linear-gradient(180deg, var(--posbg), transparent)" hero={{ kicker: "Was nimmst du ein", value: "42.380 €", changePill: { text: "+7,2% vs. Vorjahr", variant: "teal" }, meta: "Laufender Monat · 4 Wochen erfasst", sparkValues: [8200, 18600, 31200, 42380] }} composition={{ title: "C · Umsatz pro Woche", rows: [{ avatar: "19", avatarColor: "#34D399", name: "KW19", meta: "1. Woche des Monats", amount: "8.200 €" }, { avatar: "20", avatarColor: "#34D399", name: "KW20", meta: "2. Woche — stärkste Woche", amount: "10.400 €" }, { avatar: "21", avatarColor: "#34D399", name: "KW21", meta: "3. Woche", amount: "12.600 €" }, { avatar: "22", avatarColor: "#60A5FA", name: "KW22", meta: "Laufende Woche", amount: "11.180 €" }] }} crossKpi={[{ label: "Vorjahresumsatz", value: "39.540 €", delta: "+7,2% aktuell darüber", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Stärkster Kunde", value: "18.400 €", delta: "Museum Lenzburg", deltaColor: "var(--info)", accentColor: "var(--info)" }]} insight={{ body: "<b>Beobachtung:</b> Umsatz 7,2% über Vorjahr. Stärkste Woche war KW20 mit 10.400 €.<br><b>Hinweis:</b> Museum Lenzburg macht 43% des Monatsumsatzes aus — Klumpenrisiko beachten." }} linkedAreas={[{ label: "BWA", href: "/buchhaltung/bwa" }, { label: "Auftragsbuch", href: "/orders" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'db'} onClose={() => setOverlay(null)} icon={<BarChart3 className="w-5 h-5" style={{ color: 'var(--info)' }} />} title="Deckungsbeitrag" subtitle="Marge nach variablen Kosten" accentBg="linear-gradient(180deg, var(--infobg), transparent)" hero={{ kicker: "Was bleibt nach den variablen Kosten", value: "11.840 €", changePill: { text: "27,9% Marge", variant: "teal" }, meta: "Branchendurchschnitt: 25% — leicht darüber" }} crossKpi={[{ label: "Fixkosten", value: "40 %", delta: "Personal, Miete, AfA", deltaColor: "var(--info)", accentColor: "var(--info)" }, { label: "Variable Kosten", value: "32 %", delta: "Energie, Material, Chemie", deltaColor: "var(--warn)", accentColor: "var(--warn)" }, { label: "Marge", value: "28 %", delta: "Über Branchenschnitt", deltaColor: "var(--pos)", accentColor: "var(--pos)" }]} insight={{ body: "<b>Beobachtung:</b> Marge 27,9% liegt leicht über dem Branchendurchschnitt von 25%.<br><b>Warnung:</b> Steigende Goldpreise könnten die Marge ab nächster Woche unter Druck setzen." }} linkedAreas={[{ label: "BWA", href: "/buchhaltung/bwa" }, { label: "Ausgaben", href: "/buchhaltung/ausgaben" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'gewinn'} onClose={() => setOverlay(null)} icon={<TrendingUp className="w-5 h-5" style={{ color: 'var(--pos)' }} />} title="Gewinn grob" subtitle="Erlöse minus alle erfassten Kosten" accentBg="linear-gradient(180deg, var(--posbg), transparent)" hero={{ kicker: "Was bleibt am Ende übrig", value: "8.200 €", changePill: { text: "Rohgewinn laufender Monat", variant: "teal" }, meta: "Erlöse 42.380 € − Kosten 30.540 € = 8.200 € netto", sparkValues: [5400, 6200, 7100, 8200] }} crossKpi={[{ label: "Erlöse", value: "42.380 €", delta: "Nettoumsatz", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Kosten gesamt", value: "30.540 €", delta: "Fix + Variabel", deltaColor: "var(--neg)", accentColor: "var(--neg)" }, { label: "Rohgewinn", value: "8.200 €", delta: "19,4% Rendite", deltaColor: "var(--pos)", accentColor: "var(--pos)" }]} insight={{ body: "<b>Hinweis:</b> Der Rohgewinn berücksichtigt keine Sonderkosten (z.B. einmalige Reparaturen) oder ausstehende Rechnungen." }} linkedAreas={[{ label: "BWA", href: "/buchhaltung/bwa" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'forecast'} onClose={() => setOverlay(null)} icon={<Target className="w-5 h-5" style={{ color: 'var(--purple, #6D28D9)' }} />} title="Forecast Monatsende" subtitle="Hochrechnung basierend auf Auftragseingang" accentBg="linear-gradient(180deg, var(--purpbg, rgba(167,139,250,.1)), transparent)" hero={{ kicker: "Wie viel wird der Monat bringen", value: "~145.000 €", changePill: { text: "Linearer Trend auf 22 Werktagen", variant: "teal" }, meta: "5 verbleibende Werktage · Optimistisch: ~158.000 €" }} crossKpi={[{ label: "Basisprognose", value: "145.000 €", delta: "Linearer Trend", deltaColor: "var(--info)", accentColor: "var(--info)" }, { label: "Optimistisch", value: "158.000 €", delta: "Falls 3 Großaufträge bestätigt", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Verbleibend", value: "5 Tage", delta: "Werktage bis Monatsende", deltaColor: "var(--info)", accentColor: "var(--info)" }]} insight={{ body: "<b>Methodik:</b> Linearer Trend auf 22 Werktagen. Bei 5 verbleibenden Werktagen und aktuellem Auftragsbestand.<br><b>Szenario Optimistisch:</b> Falls 3 offene Großaufträge bestätigt werden: ~158.000 €." }} linkedAreas={[{ label: "Auftragsbuch", href: "/orders" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'kalkulation'} onClose={() => setOverlay(null)} icon={<Calculator className="w-5 h-5" style={{ color: 'var(--warn)' }} />} title="Kalkulationshinweise" subtitle="Veränderungen der Kostenstruktur" accentBg="linear-gradient(180deg, var(--warnbg), transparent)" hero={{ kicker: "Was verändert sich bei deinen Kosten", value: "3 Faktoren", changePill: { text: "Gold auf Warnschwelle", variant: "amber" }, meta: "Energie −2% · Material +1% · Personal ±0%" }} composition={{ title: "C · Kostenveränderungen im Detail", rows: [{ avatar: "⚡", avatarColor: "#34D399", name: "Energiekosten", meta: "−2% · Einsparung ca. 96 €/Monat durch neue Tarifverhandlung", amount: "−96 €" }, { avatar: "M", avatarColor: "#D14F3D", name: "Materialkosten", meta: "+1% · Kupfer und Nickel leicht teurer, Gold auf Warnschwelle", amount: "+36 €" }, { avatar: "P", avatarColor: "#94A3B8", name: "Personalkosten", meta: "±0% · Keine Änderung. Nächste Gehaltsrunde Q4", amount: "0 €" }, { avatar: "Au", avatarColor: "#FBBF24", name: "Goldpreis-Warnung", meta: "+14% · EK: 60 €/g → Tagespreis: 68,40 €/g — Nachkauf riskant", amount: "+14%" }] }} insight={{ body: "<b>Beobachtung:</b> Energiekosten gesunken (−2%), aber Materialkosten (+1%) fressen das teilweise auf. Gold-EK auf Warnschwelle.<br><b>Empfehlung:</b> Gold-Nachkauf aufschieben. Energieeinsparung nutzen, um Material-Anstieg zu kompensieren." }} linkedAreas={[{ label: "BWA", href: "/buchhaltung/bwa" }, { label: "Ausgaben", href: "/buchhaltung/ausgaben" }]} />
    </PerformanceDetailLayout>
  );
}
