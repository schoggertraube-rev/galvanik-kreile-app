"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import React, { useState } from 'react';
import { Users, ArrowRight, HeartHandshake, Banknote, Truck, Globe, UserCheck } from 'lucide-react';
import { PerformanceDetailLayout } from '../PerformanceDetailLayout';
import { AnalysisOverlay } from '@/components/ui/AnalysisOverlay';
import { getTopKunden } from '@/app/actions/customers.actions';

export default function KundenMarktDetail() {
  const [overlay, setOverlay] = useState<string | null>(null);
  const [topKunden, setTopKunden] = useState<any[]>([]);

  React.useEffect(() => {
    getTopKunden(5).then(setTopKunden);
  }, []);

  return (
    <PerformanceDetailLayout
      title="Kunden und Markt"
      subtitle="Top-Kunden, CLV, Zahlungsmoral, Versandarten, Regionen und Kundentypen — der Blick auf die Kundenbasis."
      icon={<Users className="w-6 h-6" style={{ color: '#fff' }} />}
      accentColor="rgba(96,165,250,0.18)"
      pill={{ label: 'STABIL', variant: 'green' }}
    >
      <div className="pd-grid">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Performance',href:'/performance'}, {label:'Kunden-markt'}]} />
        <BackButton label="Performance" href="/performance" />
      </div>
      

        {/* Top-Kunden — In-Place Overlay */}
        <div className="pd-tile" onClick={() => setOverlay('topkunden')} style={{ cursor: 'pointer' }}>
          <div className="pd-tile-hd">
            <div className="pd-tile-ico" style={{ background: 'var(--infobg)' }}>
              <UserCheck className="w-5 h-5" style={{ color: 'var(--info)' }} />
            </div>
            <div className="pd-tile-name">Top-Kunden</div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topKunden.length === 0 ? <div style={{fontSize:11, color:'var(--ink3)'}}>Noch keine Kunden</div> : topKunden.map((k, i) => {
              const maxVal = topKunden[0]?.wert || 1;
              const pct = Math.max(5, Math.round((k.wert / maxVal) * 100));
              return (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ width: 110, fontWeight: 500, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
                  <div className="pd-bar-track"><div className="pd-bar-fill" style={{ width: `${pct}%`, background: 'var(--info)' }} /></div>
                  <span style={{ fontWeight: 600, width: 54, textAlign: 'right', flexShrink: 0 }}>{k.wert.toLocaleString('de-DE')} €</span>
                </div>
              );
            })}
          </div>
          <div className="pd-tile-foot">Kundenanalyse <ArrowRight className="w-3 h-3" /></div>
        </div>

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

        {/* Kundenrisiko — In-Place Overlay */}
        <div className="pd-tile" onClick={() => setOverlay('risiko')} style={{ cursor: 'pointer' }}>
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
          <div className="pd-tile-foot">Risiko-Analyse <ArrowRight className="w-3 h-3" /></div>
        </div>

      </div>

      {/* OVERLAYS — standardized AnalysisOverlay pattern */}
      <AnalysisOverlay
        isEmpty={topKunden.length === 0}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 0, vorjahr: 0 }, { name: "KW20", ist: 0, vorjahr: 0 }, { name: "KW21", ist: 0, vorjahr: 0 }, { name: "KW22", ist: 0, vorjahr: 0 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'topkunden'} onClose={() => setOverlay(null)} icon={<UserCheck className="w-5 h-5" style={{ color: 'var(--info)' }} />} title="Top-Kunden" subtitle="Umsatzranking · CLV · Auftragshistorie · Trend" accentBg="linear-gradient(180deg, var(--infobg), transparent)" hero={{ kicker: "Wer bringt den meisten Umsatz", value: topKunden.length > 0 ? `${topKunden[0]?.wert?.toLocaleString('de-DE')} €` : "0 €", changePill: { text: "Top 5 decken 72% des Monatsumsatzes", variant: "teal" }, meta: "Aktueller Monat · 5 Kunden", sparkValues: [0, 0, 0, 0, 0, 0] }} composition={{ title: "C · Top-5 Kunden nach Monatsumsatz", rows: topKunden.map(k => ({ avatar: k.name.substring(0, 2).toUpperCase(), avatarColor: "#60A5FA", name: k.name, meta: `Umsatz: ${k.wert.toLocaleString('de-DE')} €`, amount: `${k.wert.toLocaleString('de-DE')} €` })) }} crossKpi={[{ label: "Stammkunden-Anteil", value: "82 %", delta: "38 von 47 Kunden", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Ø Auftragswert", value: "420 €", delta: "↑ +8% vs. Vorjahr", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Abwanderungsrisiko", value: "1", delta: "Autohaus Berger", deltaColor: "var(--neg)", accentColor: "var(--neg)" }]} insight={{ body: "<b>Beobachtung:</b> Daten aus der Datenbank geladen.", actions: [{ label: "Kundenkartei öffnen" }] }} linkedAreas={[{ label: "Kundenkartei", href: "/customers" }, { label: "Auftragsbuch", href: "/orders" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'clv'} onClose={() => setOverlay(null)} icon={<HeartHandshake className="w-5 h-5" style={{ color: 'var(--pos)' }} />} title="Customer Lifetime Value" subtitle="Gesamtwert jedes Kunden über die Geschäftsbeziehung" accentBg="linear-gradient(180deg, var(--posbg), transparent)" hero={{ kicker: "Wie wertvoll sind deine Kunden langfristig", value: "18.400 €", changePill: { text: "Höchster CLV: Museum Lenzburg", variant: "teal" }, meta: "82% Stammkunden · 18% Neukunden" }} composition={{ title: "C · CLV-Ranking", rows: [{ avatar: "1", avatarColor: "#60A5FA", name: "Museum Lenzburg", meta: "Seit 2019 · 42 Aufträge", amount: "18.400 €" }, { avatar: "2", avatarColor: "#60A5FA", name: "Schrauben Meier", meta: "Seit 2020 · 35 Aufträge", amount: "14.200 €" }, { avatar: "3", avatarColor: "#FBBF24", name: "Autohaus Berger", meta: "Seit 2021 · 28 Aufträge · Risiko", amount: "11.800 €" }, { avatar: "4", avatarColor: "#60A5FA", name: "Schlosserei Brunner", meta: "Seit 2022 · 19 Aufträge", amount: "9.600 €" }, { avatar: "5", avatarColor: "#34D399", name: "Uhren Keller", meta: "Seit 2023 · 12 Aufträge · Neukunde", amount: "7.200 €" }] }} crossKpi={[{ label: "Ø CLV", value: "12.240 €", delta: "Durchschnitt Top 5", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Wiederholungsrate", value: "92 %", delta: "Handwerk am treuesten", deltaColor: "var(--pos)", accentColor: "var(--pos)" }]} insight={{ body: "<b>Beobachtung:</b> 82% Stammkunden mit hohem CLV. Wiederholungsrate 92% bei Handwerkskunden." }} linkedAreas={[{ label: "Kundenkartei", href: "/customers" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'risiko'} onClose={() => setOverlay(null)} icon={<HeartHandshake className="w-5 h-5" style={{ color: 'var(--neg)' }} />} title="Kundenrisiko" subtitle="Abwanderungsanalyse — gefährdete Geschäftsbeziehungen" accentBg="linear-gradient(180deg, var(--negbg), transparent)" hero={{ kicker: "Wie viele Kunden sind gefährdet", value: "1 Kunde", changePill: { text: "Autohaus Berger — Risiko hoch", variant: "red" }, meta: "CLV 11.800 € · 28 Aufträge seit 2021 · letzter Auftrag vor 6 Wochen" }} composition={{ title: "C · Risikoindikatoren", rows: [{ avatar: "!", avatarColor: "#D14F3D", name: "2 Reklamationen in Folge", meta: "Oberflächenqualität — Charge 407 und 409", amount: "" }, { avatar: "⏱", avatarColor: "#FBBF24", name: "Antwortzeit 52h", meta: "Über 48h-Schwelle", amount: "" }, { avatar: "📅", avatarColor: "#FBBF24", name: "Lieferverzug −3 Tage", meta: "Charge 409", amount: "" }, { avatar: "📉", avatarColor: "#D14F3D", name: "Auftragsfrequenz fallend", meta: "Von 4/Monat auf 1/Monat", amount: "" }] }} crossKpi={[{ label: "Gefährdeter Umsatz", value: "3.800 €/M", delta: "Monatl. Umsatz", deltaColor: "var(--neg)", accentColor: "var(--neg)" }, { label: "Bedrohter CLV", value: "11.800 €", delta: "Gesamtwert", deltaColor: "var(--neg)", accentColor: "var(--neg)" }, { label: "Tage ohne Auftrag", value: "42 T", delta: "Normalwert: 7–14 T", deltaColor: "var(--warn)", accentColor: "var(--warn)" }]} insight={{ body: "<b>Beobachtung:</b> Autohaus Berger zeigt alle Abwanderungssignale.<br><b>Empfehlung:</b> Persönlich kontaktieren. Kulanzbadcharge anbieten.", actions: [{ label: "Anrufen" }, { label: "Kulanzbadcharge" }] }} linkedAreas={[{ label: "Kundenkartei", href: "/customers" }, { label: "Qualitätskontrolle", href: "/kontrolle" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'zahlungsmoral'} onClose={() => setOverlay(null)} icon={<Banknote className="w-5 h-5" style={{ color: 'var(--pos)' }} />} title="Zahlungsmoral" subtitle="Zahlungsziele · Pünktlichkeit · Quartalsvergleich" accentBg="linear-gradient(180deg, var(--posbg), transparent)" hero={{ kicker: "Wie pünktlich zahlen deine Kunden", value: "Ø 18 Tage", changePill: { text: "−4 Tage vs. Vorjahr", variant: "teal" }, meta: "82% pünktlich · Vorjahr Ø 22 T", sparkValues: [22, 21, 20, 19, 18, 18] }} crossKpi={[{ label: "Pünktlich", value: "82 %", delta: "↑ +5% vs. Vorjahr", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Forderungsausfälle", value: "0 €", delta: "Kein Ausfall Q2", deltaColor: "var(--pos)", accentColor: "var(--pos)" }]} insight={{ body: "<b>Beobachtung:</b> Zahlungsmoral seit 4 Quartalen besser (Ø 22 → 18 T). Kein Forderungsausfall." }} linkedAreas={[{ label: "Rechnungen", href: "/buchhaltung/rechnungen" }, { label: "Offene Posten", href: "/buchhaltung/zahlung" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'zahlungsarten'} onClose={() => setOverlay(null)} icon={<Banknote className="w-5 h-5" style={{ color: 'var(--purple, #6D28D9)' }} />} title="Zahlungsarten" subtitle="Überweisung · Bar · EC/Karte · Sonstige" accentBg="linear-gradient(180deg, var(--purpbg, rgba(167,139,250,.1)), transparent)" hero={{ kicker: "Wie zahlen deine Kunden", value: "4 Zahlungsarten", changePill: { text: "Überweisung dominiert (55%)", variant: "teal" }, meta: "B2B Überweisung · B2C Karte" }} composition={{ title: "C · Verteilung nach Zahlungsart", rows: [{ avatar: "Ü", avatarColor: "#60A5FA", name: "Überweisung", meta: "B2B-Hauptweg", amount: "55 %" }, { avatar: "B", avatarColor: "#34D399", name: "Barzahlung", meta: "Bei Abholung", amount: "25 %" }, { avatar: "E", avatarColor: "#A78BFA", name: "EC / Karte", meta: "Zunehmend Privatkunden", amount: "12 %" }, { avatar: "S", avatarColor: "#94A3B8", name: "Sonstige", meta: "Vorkasse / Nachnahme", amount: "8 %" }] }} insight={{ body: "<b>Beobachtung:</b> Überweisung 55% Standard bei B2B. EC/Karte +3% bei Privatkunden." }} linkedAreas={[{ label: "Rechnungen", href: "/buchhaltung/rechnungen" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'logistik'} onClose={() => setOverlay(null)} icon={<Truck className="w-5 h-5" style={{ color: 'var(--pos)' }} />} title="Abholung und Versand" subtitle="Logistik-Split · Versandkosten" accentBg="linear-gradient(180deg, var(--posbg), transparent)" hero={{ kicker: "Wie kommt die Ware zum Kunden", value: "82 % Abholung", changePill: { text: "Versandanteil 18% — stabil", variant: "teal" }, meta: "Geringe Versandkosten" }} crossKpi={[{ label: "Abholung", value: "82 %", delta: "CH-Kunden", deltaColor: "var(--pos)", accentColor: "var(--pos)" }, { label: "Versand", value: "18 %", delta: "DE + AT", deltaColor: "var(--info)", accentColor: "var(--info)" }, { label: "Versandkosten/M", value: "≈ 340 €", delta: "Niedriger Anteil", deltaColor: "var(--pos)", accentColor: "var(--pos)" }]} insight={{ body: "<b>Beobachtung:</b> 82% Abholung reduziert Kosten erheblich. Versandkunden bestellen 40% mehr." }} linkedAreas={[{ label: "Auftragsbuch", href: "/orders" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'regionen'} onClose={() => setOverlay(null)} icon={<Globe className="w-5 h-5" style={{ color: 'var(--info)' }} />} title="Geo-Verteilung" subtitle="Kundenverteilung nach Herkunftsland" accentBg="linear-gradient(180deg, var(--infobg), transparent)" hero={{ kicker: "Woher kommen deine Kunden", value: "DACH 95 %", changePill: { text: "3 Länder aktiv", variant: "teal" }, meta: "CH 60% · DE 25% · AT 10% · Rest-EU 5%" }} composition={{ title: "C · Verteilung nach Region", rows: [{ avatar: "CH", avatarColor: "#D14F3D", name: "Schweiz", meta: "28 Kunden · 60% · Kernmarkt", amount: "60 %" }, { avatar: "DE", avatarColor: "#FBBF24", name: "Deutschland", meta: "12 Kunden · 25% · Versand", amount: "25 %" }, { avatar: "AT", avatarColor: "#60A5FA", name: "Österreich", meta: "5 Kunden · 10% · Wachstum", amount: "10 %" }, { avatar: "EU", avatarColor: "#94A3B8", name: "Rest-EU", meta: "2 Kunden · 5%", amount: "5 %" }] }} insight={{ body: "<b>Beobachtung:</b> DACH-Fokus 95%. Österreich wächst." }} linkedAreas={[{ label: "Kundenkartei", href: "/customers" }]} />

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        trend={{ chartType: "line", chartData: [{ name: "KW19", ist: 85, vorjahr: 70 }, { name: "KW20", ist: 82, vorjahr: 72 }, { name: "KW21", ist: 79, vorjahr: 75 }, { name: "KW22", ist: 76, vorjahr: 78 }] }}
        tabs={[{ id: "1", label: "Aktueller Monat" }, { id: "2", label: "Vorjahr" }]} open={overlay === 'kundentypen'} onClose={() => setOverlay(null)} icon={<Users className="w-5 h-5" style={{ color: 'var(--warn)' }} />} title="Kundentypen" subtitle="B2B Industrie · B2B Handwerk · B2C Privat" accentBg="linear-gradient(180deg, var(--warnbg), transparent)" hero={{ kicker: "Welche Kundentypen hast du", value: "90 % B2B", changePill: { text: "Industrie dominiert 60%", variant: "teal" }, meta: "Industrie 60% · Handwerk 30% · B2C 10%" }} composition={{ title: "C · Verteilung nach Kundentyp", rows: [{ avatar: "I", avatarColor: "#60A5FA", name: "B2B Industrie", meta: "Höchstes Volumen · Ø 680 €", amount: "60 %" }, { avatar: "H", avatarColor: "#34D399", name: "B2B Handwerk", meta: "Loyalste · Wiederholungsrate 92%", amount: "30 %" }, { avatar: "P", avatarColor: "#A78BFA", name: "B2C Privat", meta: "Höchster Express-Anteil", amount: "10 %" }] }} crossKpi={[{ label: "Ø Volumen Industrie", value: "680 €", delta: "Höchster Einzelauftragswert", deltaColor: "var(--info)", accentColor: "var(--info)" }, { label: "Wiederholungsrate HW", value: "92 %", delta: "Handwerk am treuesten", deltaColor: "var(--pos)", accentColor: "var(--pos)" }]} insight={{ body: "<b>Beobachtung:</b> B2B 90% — solide. Handwerk am treuesten. Industrie höchstes Volumen." }} linkedAreas={[{ label: "Kundenkartei", href: "/customers" }]} />
    </PerformanceDetailLayout>
  );
}

