"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Beaker, Loader2, AlertCircle } from "lucide-react";
import { getWhatIfKontext } from "../actions";
import { berechneInvestition, berechneMitarbeiter, berechnePreis, berechneNeukunde, KontextDaten } from "@/lib/whatif/engine";
import { KachelInfo } from "@/components/ui/KachelInfo";

export function WhatIfStudio() {
  const [open, setOpen] = useState(false);
  const [kontext, setKontext] = useState<KontextDaten | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'investition' | 'mitarbeiter' | 'preis' | 'neukunde'>('investition');

  useEffect(() => {
    if (open && !kontext && !loading) {
      setLoading(true);
      getWhatIfKontext().then(res => {
        setKontext(res);
        setLoading(false);
      });
    }
  }, [open, kontext, loading]);

  if (!open) {
    return (
      <div 
        id="whatif-studio-btn"
        className="bg-navy-900 rounded-2xl shadow-sm p-4 flex items-center justify-between cursor-pointer hover:bg-navy-800 transition-colors"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-3 text-white">
          <Beaker className="w-5 h-5 text-accent-orange" />
          <h3 className="font-bold text-lg">What-If Studio</h3>
          <span className="text-navy-300 text-sm hidden md:inline-block">Szenarien durchspielen & Entscheidungen absichern</span>
        </div>
        <ChevronDown className="w-5 h-5 text-white" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col">
      <div 
        className="bg-navy-900 rounded-t-2xl p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(false)}
      >
        <div className="flex items-center gap-3 text-white">
          <Beaker className="w-5 h-5 text-accent-orange" />
          <h3 className="font-bold text-lg">What-If Studio</h3>
        </div>
        <ChevronUp className="w-5 h-5 text-white" />
      </div>

      {loading || !kontext ? (
        <div className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-navy-500 mb-4" />
          <p className="text-text-muted">Lade operative Kontextdaten...</p>
        </div>
      ) : (
        <div className="p-0 flex flex-col h-full">
          {/* Tabs */}
          <div className="flex border-b border-neutral-gray-100 overflow-x-auto">
            <TabButton active={activeTab === 'investition'} onClick={() => setActiveTab('investition')} label="Investition" />
            <TabButton active={activeTab === 'mitarbeiter'} onClick={() => setActiveTab('mitarbeiter')} label="Mitarbeiter" />
            <TabButton active={activeTab === 'preis'} onClick={() => setActiveTab('preis')} label="Preiserhöhung" />
            <TabButton active={activeTab === 'neukunde'} onClick={() => setActiveTab('neukunde')} label="Neukunde" />
          </div>

          <div className="p-6 flex-1 bg-neutral-gray-50/30">
            {activeTab === 'investition' && <TabInvestition kontext={kontext} />}
            {activeTab === 'mitarbeiter' && <TabMitarbeiter kontext={kontext} />}
            {activeTab === 'preis' && <TabPreis kontext={kontext} />}
            {activeTab === 'neukunde' && <TabNeukunde kontext={kontext} />}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${
        active ? 'border-accent-orange text-navy-900 bg-orange-50/50' : 'border-transparent text-text-muted hover:bg-neutral-gray-50 hover:text-navy-700'
      }`}
    >
      {label}
    </button>
  );
}

// --- TAB INVESTITION ---
function TabInvestition({ kontext }: { kontext: KontextDaten }) {
  const [kostenstelle, setKostenstelle] = useState<string>('');
  const [invest, setInvest] = useState(50000);
  const [dauer, setDauer] = useState(7);
  const [zins, setZins] = useState(0);
  const [ersparnis, setErsparnis] = useState(0);
  const [mehrumsatz, setMehrumsatz] = useState(0);
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    if (!kostenstelle) return;
    const res = berechneInvestition({
      investitionssumme: invest,
      lebensdauer_jahre: dauer,
      zinssatz_prozent: zins,
      stundenersparnis_tag: ersparnis,
      mehrumsatz_monat: mehrumsatz,
      kostenstelle_kuerzel: kostenstelle
    }, kontext);
    setResult(res);
  };

  const ksKeys = Object.keys(kontext.verfuegbare_stunden_je_ks);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
      <div className="absolute top-0 right-0 z-10 -mt-2 -mr-2">
        <KachelInfo 
          wasZeigtDieKachel="Prüfen Sie ob sich eine Anschaffung rechnet."
          wasBedeutetDas="Die Berechnung nutzt Ihre echten Kosten- und Auslastungsdaten."
          datenquelle="Berechnet aus Monats-DB und Station-Auslastung"
        />
      </div>
      <div className="flex flex-col gap-4">
        <h4 className="font-bold text-navy-900">Annahmen & Parameter</h4>
        
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1">Kostenstelle / Station</label>
          <select 
            className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm"
            value={kostenstelle} onChange={e => setKostenstelle(e.target.value)}
          >
            <option value="">Bitte wählen...</option>
            {ksKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          {kostenstelle && kontext.db_marge_je_ks[kostenstelle] === null && (
            <p className="text-xs text-danger-red mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Datengrundlage für Station fehlt. Erst nach 3 abgeschlossenen Aufträgen aussagekräftig.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1">Investitionssumme (€)</label>
          <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={invest} onChange={e => setInvest(Number(e.target.value))} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Nutzungsdauer (Jahre)</label>
            <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={dauer} onChange={e => setDauer(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Zinssatz (%)</label>
            <input type="number" step="0.1" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={zins} onChange={e => setZins(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Zeit-Ersparnis (h/Tag)</label>
            <input type="number" step="0.1" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={ersparnis} onChange={e => setErsparnis(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Zusatz-Umsatz (€/Monat)</label>
            <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={mehrumsatz} onChange={e => setMehrumsatz(Number(e.target.value))} />
          </div>
        </div>

        <button 
          onClick={calculate}
          disabled={!kostenstelle || kontext.db_marge_je_ks[kostenstelle] === null}
          className="mt-2 bg-navy-600 hover:bg-navy-700 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          Berechnen
        </button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-gray-200 p-6 flex flex-col">
        <h4 className="font-bold text-navy-900 mb-4">Ergebnis</h4>
        {!result ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm text-center">
            Bitte Parameter eingeben und auf Berechnen klicken.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <EmpfehlungsBox result={result} />
            
            <div className="grid grid-cols-2 gap-4 border-t border-neutral-gray-100 pt-4">
              <ErgebnisWert label="Netto-Wirkung / Monat" value={`€ ${Math.round(result.netto_monatswirkung)}`} highlight={result.netto_monatswirkung > 0} />
              <ErgebnisWert label="Break-Even" value={result.break_even_monate ? `${Math.round(result.break_even_monate)} Monate` : 'Nie'} />
              <ErgebnisWert label="Abschreibung / Monat" value={`€ ${Math.round(result.abschreibung_monatlich)}`} />
              <ErgebnisWert label="Zins / Monat" value={`€ ${Math.round(result.zins_monatlich)}`} />
            </div>

            <button className="text-sm text-accent-orange font-semibold hover:underline mt-auto self-start">Datenherkunft anzeigen</button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- TAB MITARBEITER ---
function TabMitarbeiter({ kontext }: { kontext: KontextDaten }) {
  const [kostenstelle, setKostenstelle] = useState<string>('');
  const [gehalt, setGehalt] = useState(3500);
  const [stunden, setStunden] = useState(40);
  const [produktiv, setProduktiv] = useState(75);
  const [verrechnung, setVerrechnung] = useState(65);
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    if (!kostenstelle) return;
    const res = berechneMitarbeiter({
      bruttogehalt_monatlich: gehalt,
      wochenstunden: stunden,
      produktive_quote: produktiv / 100,
      verrechnungssatz: verrechnung,
      kostenstelle_kuerzel: kostenstelle,
      lohnnebenkosten_faktor: 1.28,
      urlaubstage: 28,
      krankheitsquote: 0.04
    }, kontext);
    setResult(res);
  };

  const ksKeys = Object.keys(kontext.verfuegbare_stunden_je_ks);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
      <div className="absolute top-0 right-0 z-10 -mt-2 -mr-2">
        <KachelInfo 
          wasZeigtDieKachel="Prüfen Sie ob sich eine Anschaffung rechnet."
          wasBedeutetDas="Die Berechnung nutzt Ihre echten Kosten- und Auslastungsdaten."
          datenquelle="Berechnet aus Monats-DB und Station-Auslastung"
        />
      </div>
      <div className="flex flex-col gap-4">
        <h4 className="font-bold text-navy-900">Annahmen & Parameter</h4>
        
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1">Einsatzort (Station)</label>
          <select 
            className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm"
            value={kostenstelle} onChange={e => setKostenstelle(e.target.value)}
          >
            <option value="">Bitte wählen...</option>
            {ksKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          {kostenstelle && kontext.db_marge_je_ks[kostenstelle] === null && (
            <p className="text-xs text-danger-red mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Datengrundlage fehlt.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Bruttogehalt (€/Mo)</label>
            <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={gehalt} onChange={e => setGehalt(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Verrechnungssatz (€/h)</label>
            <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={verrechnung} onChange={e => setVerrechnung(Number(e.target.value))} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Wochenstunden</label>
            <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={stunden} onChange={e => setStunden(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Produktivquote (%)</label>
            <input type="range" min="30" max="95" className="w-full" value={produktiv} onChange={e => setProduktiv(Number(e.target.value))} />
            <div className="text-right text-xs font-medium">{produktiv}%</div>
          </div>
        </div>

        <button 
          onClick={calculate}
          disabled={!kostenstelle || kontext.db_marge_je_ks[kostenstelle] === null}
          className="mt-2 bg-navy-600 hover:bg-navy-700 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          Berechnen
        </button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-gray-200 p-6 flex flex-col">
        <h4 className="font-bold text-navy-900 mb-4">Ergebnis</h4>
        {!result ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm text-center">
            Bitte Parameter eingeben und auf Berechnen klicken.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <EmpfehlungsBox result={result} />
            
            <div className="grid grid-cols-2 gap-4 border-t border-neutral-gray-100 pt-4">
              <ErgebnisWert label="Break-Even Auslastung" value={`${Math.round(result.break_even_auslastung * 100)} %`} highlight={result.empfehlung === 'ja'} />
              <ErgebnisWert label="Vollkosten / Monat" value={`€ ${Math.round(result.vollkosten_monatlich)}`} />
              <ErgebnisWert label="Echter Kostensatz" value={`€ ${Math.round(result.kostensatz_real)} / h`} />
              <ErgebnisWert label="Max. DB-Potenzial" value={`€ ${Math.round(result.db_zusatz_vollauslastung)}`} />
            </div>

            <button className="text-sm text-accent-orange font-semibold hover:underline mt-auto self-start">Datenherkunft anzeigen</button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- TAB PREIS ---
function TabPreis({ kontext }: { kontext: KontextDaten }) {
  const [gruppe, setGruppe] = useState<'alle' | 'stamm' | 'neu' | 'privat' | 'gewerbe'>('alle');
  const [erhoehung, setErhoehung] = useState(5);
  const [abwanderung, setAbwanderung] = useState(5);
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const res = berechnePreis({
      erhoehung_prozent: erhoehung,
      abwanderungsquote: abwanderung / 100,
      kundengruppe: gruppe
    }, kontext);
    setResult(res);
  };

  const umsatzIst0 = kontext.umsatz_12m_je_kundengruppe[gruppe] === 0 || !kontext.umsatz_12m_je_kundengruppe[gruppe];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
      <div className="absolute top-0 right-0 z-10 -mt-2 -mr-2">
        <KachelInfo 
          wasZeigtDieKachel="Prüfen Sie ob sich eine Anschaffung rechnet."
          wasBedeutetDas="Die Berechnung nutzt Ihre echten Kosten- und Auslastungsdaten."
          datenquelle="Berechnet aus Monats-DB und Station-Auslastung"
        />
      </div>
      <div className="flex flex-col gap-4">
        <h4 className="font-bold text-navy-900">Annahmen & Parameter</h4>
        
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1">Kundengruppe</label>
          <select 
            className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm"
            value={gruppe} onChange={e => setGruppe(e.target.value as any)}
          >
            <option value="alle">Alle Kunden</option>
            <option value="stamm">Stammkunden</option>
            <option value="neu">Neukunden</option>
            <option value="privat">Privatkunden</option>
            <option value="gewerbe">Gewerbekunden</option>
          </select>
          {umsatzIst0 && (
            <p className="text-xs text-danger-red mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Keine Umsatzdaten für diese Gruppe
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1">Preiserhöhung (%)</label>
          <input type="range" min="1" max="25" className="w-full" value={erhoehung} onChange={e => setErhoehung(Number(e.target.value))} />
          <div className="text-right text-xs font-medium">+{erhoehung}%</div>
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1">Erwartete Abwanderung (%)</label>
          <input type="range" min="0" max="30" className="w-full" value={abwanderung} onChange={e => setAbwanderung(Number(e.target.value))} />
          <div className="text-right text-xs font-medium">{abwanderung}% Verlust</div>
        </div>

        <button 
          onClick={calculate}
          disabled={umsatzIst0}
          className="mt-2 bg-navy-600 hover:bg-navy-700 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          Berechnen
        </button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-gray-200 p-6 flex flex-col">
        <h4 className="font-bold text-navy-900 mb-4">Ergebnis</h4>
        {!result ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm text-center">
            Bitte Parameter eingeben und auf Berechnen klicken.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <EmpfehlungsBox result={result} />
            
            <div className="grid grid-cols-2 gap-4 border-t border-neutral-gray-100 pt-4">
              <ErgebnisWert label="Umsatz-Effekt (Netto)" value={`€ ${Math.round(result.netto_effekt).toLocaleString()}`} highlight={result.netto_effekt > 0} />
              <ErgebnisWert label="Basis-Umsatz" value={`€ ${Math.round(result.basis_umsatz_12m).toLocaleString()}`} />
              <ErgebnisWert label="Umsatzverlust (Risiko)" value={`€ ${Math.round(result.risiko_umsatzverlust).toLocaleString()}`} />
            </div>

            {result.top_5_gefaehrdet.length > 0 && (
              <div className="mt-2 text-xs text-text-muted">
                <p className="font-semibold mb-1">Gefährdete Top-Kunden (Umsatz):</p>
                <ul className="list-disc pl-4">
                  {result.top_5_gefaehrdet.map((k: any) => (
                    <li key={k.name}>{k.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- TAB NEUKUNDE ---
function TabNeukunde({ kontext }: { kontext: KontextDaten }) {
  const [kostenstelle, setKostenstelle] = useState<string>('');
  const [auftragswert, setAuftragswert] = useState(2500);
  const [stunden, setStunden] = useState(15);
  const [haeufigkeit, setHaeufigkeit] = useState(12);
  const [zahlungsziel, setZahlungsziel] = useState(30);
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    if (!kostenstelle) return;
    const res = berechneNeukunde({
      auftragswert: auftragswert,
      stunden_pro_auftrag: stunden,
      haeufigkeit_jahr: haeufigkeit,
      zahlungsfrist_tage: zahlungsziel,
      hauptstation: kostenstelle
    }, kontext);
    setResult(res);
  };

  const ksKeys = Object.keys(kontext.verfuegbare_stunden_je_ks);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="flex flex-col gap-4">
        <h4 className="font-bold text-navy-900">Annahmen & Parameter</h4>
        
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1">Hauptstation (Engpass-Fokus)</label>
          <select 
            className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm"
            value={kostenstelle} onChange={e => setKostenstelle(e.target.value)}
          >
            <option value="">Bitte wählen...</option>
            {ksKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          {kostenstelle && kontext.db_marge_je_ks[kostenstelle] === null && (
            <p className="text-xs text-danger-red mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Datengrundlage fehlt.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Ø Auftragswert (€)</label>
            <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={auftragswert} onChange={e => setAuftragswert(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Ø Stunden pro Auftrag</label>
            <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={stunden} onChange={e => setStunden(Number(e.target.value))} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Aufträge / Jahr</label>
            <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={haeufigkeit} onChange={e => setHaeufigkeit(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Zahlungsziel (Tage)</label>
            <input type="number" className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm" value={zahlungsziel} onChange={e => setZahlungsziel(Number(e.target.value))} />
          </div>
        </div>

        <button 
          onClick={calculate}
          disabled={!kostenstelle || kontext.db_marge_je_ks[kostenstelle] === null}
          className="mt-2 bg-navy-600 hover:bg-navy-700 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          Berechnen
        </button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-gray-200 p-6 flex flex-col">
        <h4 className="font-bold text-navy-900 mb-4">Ergebnis</h4>
        {!result ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm text-center">
            Bitte Parameter eingeben und auf Berechnen klicken.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <EmpfehlungsBox result={result} />
            
            <div className="grid grid-cols-2 gap-4 border-t border-neutral-gray-100 pt-4">
              <ErgebnisWert label="Zusatz-DB / Jahr" value={`€ ${Math.round(result.db_jahr).toLocaleString()}`} highlight={result.db_jahr > 0} />
              <ErgebnisWert label="Neue Auslastung" value={`${Math.round(result.auslastung_nach_annahme * 100)} %`} highlight={result.auslastung_nach_annahme < 0.95} />
              <ErgebnisWert label="Zusatzstunden" value={`${Math.round(result.zusatz_auslastung_stunden)} h / Jahr`} />
              <ErgebnisWert label="Working Capital" value={`€ ${Math.round(result.working_capital_bedarf).toLocaleString()}`} />
            </div>

            <button className="text-sm text-accent-orange font-semibold hover:underline mt-auto self-start">Datenherkunft anzeigen</button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Hilfskomponenten ---
function EmpfehlungsBox({ result }: { result: any }) {
  let color = 'bg-neutral-gray-100 text-neutral-gray-600 border-neutral-gray-200';
  let titleColor = 'text-navy-900';
  let label = 'Keine Empfehlung';
  
  if (result.empfehlung === 'ja') {
    color = 'bg-emerald-50 border-emerald-200 text-emerald-800';
    titleColor = 'text-emerald-900';
    label = 'Empfehlung: JA';
  } else if (result.empfehlung === 'abwaegen' || result.empfehlung === 'engpass_beachten') {
    color = 'bg-amber-50 border-amber-200 text-amber-800';
    titleColor = 'text-amber-900';
    label = 'Empfehlung: ABWÄGEN';
  } else if (result.empfehlung === 'nein') {
    color = 'bg-danger-red/10 border-danger-red/30 text-danger-red';
    titleColor = 'text-danger-red';
    label = 'Empfehlung: NEIN';
  }

  return (
    <div className={`p-4 rounded-xl border ${color}`}>
      <h5 className={`font-bold text-sm mb-1 ${titleColor}`}>{label}</h5>
      <p className="text-sm">{result.empfehlung_text}</p>
    </div>
  );
}

function ErgebnisWert({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`font-bold text-lg ${highlight ? 'text-emerald-600' : 'text-navy-900'}`}>{value}</span>
    </div>
  );
}
