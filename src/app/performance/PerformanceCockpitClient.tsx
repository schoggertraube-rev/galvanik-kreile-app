"use client";

import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import React, { useState, useEffect } from 'react';
import { AnalyseTileSummary, AnalyseTileKey } from '@/lib/analyse/dataContracts';
import { AnalyseDrillOverlay } from '@/features/analyse/AnalyseDrillOverlay';
import { getAnalyseOverview } from '@/features/analyse/analyse.actions';

import { 
  Moon, Sun, Sparkles
} from 'lucide-react';

import { WerkstattPulsKachel } from "./components/WerkstattPulsKachel";
import { UmsatzMargeKachel } from "./components/UmsatzMargeKachel";
import { QualitaetRisikoKachel } from "./components/QualitaetRisikoKachel";
import { BaederMaterialKachel } from "./components/BaederMaterialKachel";
import { KundenMarktKachel } from "./components/KundenMarktKachel";
import { MarketingWirkungKachel } from "./components/MarketingWirkungKachel";

interface Props {
  initialOverviews: AnalyseTileSummary[];
  initialError?: string;
  initialLoadedAt: string;
}

type AnalysePeriod = 'Heute' | 'Woche' | 'Monat';

export function PerformanceCockpitClient({ initialOverviews, initialError, initialLoadedAt }: Props) {
  const [drillTile, setDrillTile] = useState<AnalyseTileKey | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [tab, setTab] = useState<AnalysePeriod>('Monat');
  const [overviews, setOverviews] = useState(initialOverviews);
  const [loadedAt, setLoadedAt] = useState(initialLoadedAt);
  const [dataError, setDataError] = useState<string | null>(initialError || null);
  const [loadingPeriod, setLoadingPeriod] = useState<AnalysePeriod | null>(null);
  
  // Sync theme
  useEffect(() => {
    const saved = localStorage.getItem('perfTheme');
    if (saved === 'dark' || saved === 'light') {
      setTimeout(() => setTheme(saved), 0);
    }
  }, []);
  
  const toggleTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    localStorage.setItem('perfTheme', t);
  };

  const loadPeriod = async (period: AnalysePeriod) => {
    if (period === tab || loadingPeriod) return;
    setLoadingPeriod(period);
    try {
      const result = await getAnalyseOverview(period);
      if (result.error) {
        setDataError(result.error.message);
        return;
      }
      setOverviews(result.data);
      setTab(period);
      setLoadedAt(new Date().toISOString());
      setDataError(null);
      setDrillTile(null);
    } catch {
      setDataError("Analysedaten konnten nicht geladen werden.");
    } finally {
      setLoadingPeriod(null);
    }
  };

  const loadedAtLabel = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(loadedAt));

  return (
    <div className={`perf-wrapper ${theme === 'light' ? 'light' : ''}`}>
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Performance',href:'/performance'}]} />
        <BackButton label="Home" href="/" />
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .perf-wrapper {
          --bg: #0E1626; --sf: #1A2436; --sf2: #222E42; --sf3: #2A3650;
          --ink: #EEF2F8; --ink2: #9FB0C7; --ink3: #6B7A91;
          --bd: rgba(255,255,255,0.09); --bd2: rgba(255,255,255,0.14);
          --pos: #34D399; --neg: #F87171; --warn: #FBBF24; --info: #60A5FA;
          --cyan: #22D3EE; --purple: #A78BFA;
          --posbg: rgba(52,211,153,0.12); --negbg: rgba(248,113,113,0.12);
          --warnbg: rgba(251,191,36,0.12); --infobg: rgba(96,165,250,0.12);
          --purpbg: rgba(167,139,250,0.1); --glass: rgba(255,255,255,0.04);
          --font: 'DM Sans', system-ui, sans-serif;
          
          background: var(--bg);
          color: var(--ink);
          font-family: var(--font);
          transition: background 0.4s, color 0.4s;
          min-height: 100vh;
          padding: 16px;
          border-radius: 20px;
        }
        .perf-wrapper.light {
          --bg: #EDEBE4; --sf: #FFFFFF; --sf2: #F4F1EB; --sf3: #EBE8E0;
          --ink: #1A2847; --ink2: #4B5563; --ink3: #6E7A8A;
          --bd: rgba(26,40,71,0.1); --bd2: rgba(26,40,71,0.16);
          --pos: #059669; --neg: #DC2626; --warn: #B45309; --info: #2563EB;
          --cyan: #0E7490; --purple: #6D28D9;
          --posbg: rgba(5,150,105,0.1); --negbg: rgba(220,38,38,0.08);
          --warnbg: rgba(180,83,9,0.09); --infobg: rgba(37,99,235,0.08);
          --purpbg: rgba(109,40,217,0.08); --glass: rgba(255,255,255,0.55);
        }
        
        .perf-inner { max-width: 1400px; margin: 0 auto; width: 100%; }
        
        .hd { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; flex-wrap: wrap; justify-content: flex-end; }
        .ctrls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .tabs { display: flex; gap: 1px; background: var(--sf2); border-radius: 10px; padding: 3px; }
        .tabb { font-size: 11px; padding: 6px 11px; border-radius: 8px; border: none; background: none; color: var(--ink2); cursor: pointer; font-family: var(--font); font-weight: 500; transition: 0.15s; }
        .tabb.on { background: var(--sf); color: var(--ink); box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        .tsw { display: flex; background: var(--sf2); border-radius: 10px; padding: 3px; gap: 1px; }
        .tw { font-size: 11px; padding: 6px 10px; border-radius: 8px; border: none; background: none; color: var(--ink2); cursor: pointer; font-family: var(--font); font-weight: 500; transition: 0.15s; display:flex; align-items:center; gap:4px; }
        .tw.on { background: var(--sf); color: var(--ink); box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        .stamp { font-size: 11px; color: var(--ink3); margin: 0 0 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .stamp b { font-weight: 500; color: var(--ink2); }

        .cmp-row { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; flex-wrap: wrap; }
        .cmp-btn { display: flex; align-items: center; gap: 7px; padding: 8px 14px; border: 1px solid var(--bd); border-radius: 10px; background: var(--sf); color: var(--ink2); font-size: 12px; font-family: var(--font); font-weight: 500; cursor: pointer; transition: all 0.25s; white-space: nowrap; }
        .cmp-btn:hover { border-color: var(--info); color: var(--ink); }
        .cmp-btn.active { background: var(--infobg); border-color: var(--info); color: var(--info); }
        .cmp-dd { display: flex; gap: 1px; background: var(--sf2); border-radius: 8px; padding: 2px; }
        .cmp-opt { font-size: 10px; padding: 5px 10px; border-radius: 6px; border: none; background: none; color: var(--ink3); cursor: pointer; font-family: var(--font); font-weight: 500; transition: 0.15s; }
        .cmp-opt.on { background: var(--sf); color: var(--ink); }
        .cmp-opt:hover { color: var(--ink2); }
        .cmp-lbl { font-size: 11px; color: var(--info); font-weight: 600; display: none; align-items: center; gap: 5px; }
        .cmp-lbl.show { display: flex; }
        .cmp-x { cursor: pointer; opacity: 0.6; transition: opacity 0.2s; font-size: 13px; }
        .cmp-x:hover { opacity: 1; }

        .delta { display: none; margin-top: 4px; padding: 3px 9px; border-radius: 6px; font-size: 10px; font-weight: 600; width: fit-content; animation: fadeIn 0.35s ease; }
        .delta.show { display: inline-block; }
        .d-pos { background: var(--posbg); color: var(--pos); }
        .d-neg { background: var(--negbg); color: var(--neg); }
        .d-warn { background: var(--warnbg); color: var(--warn); }
        .d-neutral { background: var(--sf2); color: var(--ink2); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }

        .t-grid { display: grid; gap: 16px; margin: 0 0 16px; }
        .t-g2 { display: grid; gap: 16px; grid-template-columns: 1fr; }
        @media(min-width:768px) { .t-g2 { grid-template-columns: repeat(2, 1fr); } }
        @media(min-width:1200px) { .t-g2 { grid-template-columns: repeat(2, 1fr); } }
        .t-tile { background: var(--sf); border: 0.5px solid var(--bd); border-radius: 16px; padding: 24px; cursor: pointer; position: relative; overflow: hidden; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s, border-color 0.3s; }
        .t-tile:hover { transform: translateY(-5px); box-shadow: 0 20px 50px rgba(0,0,0,0.2); border-color: var(--bd2); }
        .perf-wrapper.light .t-tile:hover { box-shadow: 0 16px 40px rgba(0,0,0,0.08); }
        .t-arr { position: absolute; bottom: 16px; right: 18px; font-size: 10px; color: var(--ink3); opacity: 0; transition: opacity 0.25s, transform 0.25s; display: flex; align-items: center; gap: 4px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px;}
        .t-tile:hover .t-arr { opacity: 1; transform: translateX(3px); }
        .t-hero { grid-column: 1 / -1; }
        .t-glow { position: absolute; top: -20px; right: -20px; width: 140px; height: 140px; border-radius: 50%; filter: blur(60px); opacity: 0.12; pointer-events: none; transition: opacity 0.3s; }
        .t-tile:hover .t-glow { opacity: 0.2; }
        .t-th { display: flex; align-items: center; justify-content: space-between; margin: 0 0 14px; gap: 8px; }
        .t-tl { display: flex; align-items: center; gap: 10px; }
        .t-ico { width: 40px; height: 40px; border-radius: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.25s; }
        .t-tile:hover .t-ico { transform: scale(1.08); }
        .t-name { font-size: 24px; font-weight: 700; line-height: 1.1; letter-spacing: -0.5px; }
        .t-sub { font-size: 12px; color: var(--ink2); margin-top: 4px; font-weight: 500; }
        .t-pill { font-size: 9px; font-weight: 600; padding: 4px 10px; border-radius: 8px; white-space: nowrap; letter-spacing: 0.3px; }
        .t-pill-g { background: var(--posbg); color: var(--pos); } .t-pill-y { background: var(--warnbg); color: var(--warn); } .t-pill-p { background: var(--purpbg); color: var(--purple); }

        .metrics { display: flex; flex-wrap: wrap; gap: 8px 20px; }
        .m { min-width: 0; }
        .ml { font-size: 10px; color: var(--ink3); margin: 0 0 2px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }
        .mv { font-size: 20px; font-weight: 600; line-height: 1.15; } .mv.sm { font-size: 16px; }
        .md { font-size: 10px; margin-top: 2px; font-weight: 500; }
        .pos { color: var(--pos); } .neg { color: var(--neg); } .warn { color: var(--warn); } .info { color: var(--info); } .pu { color: var(--purple); }
        
        .mbars { display: flex; align-items: flex-end; gap: 4px; height: 32px; margin-top: 12px; }
        .mbar { flex: 1; border-radius: 3px 3px 0 0; background:var(--bd); position:relative; }
        .mbar-f { position:absolute; bottom:0; left:0; right:0; border-radius: 3px 3px 0 0; transition: height 1.2s ease; }
        .mbar-labels { display: flex; gap: 4px; margin-top: 3px; }
        .mbar-labels span { flex: 1; font-size: 8px; color: var(--ink3); text-align: center; font-weight: 500; }
        
        .hero-body { display: flex; align-items: flex-start; gap: 28px; flex-wrap: wrap; }
        .hero-left { flex: 1; min-width: 200px; }
        .ring { position: relative; width: 80px; height: 80px; flex-shrink: 0; }
        .rval { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 19px; font-weight: 700; }
        .wgoal { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
        .wprog { width: 90px; height: 6px; background: var(--bd); border-radius: 3px; overflow: hidden; }
        .wpf { height: 100%; background: linear-gradient(90deg, var(--pos), var(--cyan)); border-radius: 3px; transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1); }
        
        .spk { margin-top: 10px; }
        .chips { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
        .chip { font-size: 10px; padding: 5px 10px; background: var(--sf2); border-radius: 8px; display: flex; align-items: center; gap: 6px; font-weight: 500; transition: background 0.2s; }
        .chip:hover { background: var(--sf3); }
        .cdot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .alertbox { margin-top: 10px; padding: 8px 12px; border-radius: 9px; font-size: 11px; line-height: 1.5; }
        .custrow { margin-top: 10px; display: flex; gap: 12px; font-size: 10px; color: var(--ink2); flex-wrap: wrap; font-weight: 500; }

        .ki-tile { background: linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(6,182,212,0.06) 100%); border: 0.5px solid rgba(52,211,153,0.3); grid-column: 1 / -1; padding: 16px 20px !important; display: flex; align-items: center; gap: 14px; transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s; }
        .ki-tile:hover { border-color: rgba(52,211,153,0.5); }
        .ki-tile .t-glow { background: var(--pos) !important; opacity: 0.15; }
        .ki-tile .t-th { margin: 0 !important; flex: 1; }
        .ki-tile .ki-hint { font-size: 11px; color: var(--ink2); margin-top: 2px; }
        .perf-wrapper.light .ki-tile { background: linear-gradient(135deg, rgba(5,150,105,0.06) 0%, rgba(14,116,144,0.04) 100%); border-color: rgba(5,150,105,0.2); }
        .perf-wrapper.light .ki-tile:hover { border-color: rgba(5,150,105,0.4); }

        .l2-box { background: var(--sf2); border-radius: 12px; padding: 16px; border: 1px solid var(--bd); margin-bottom: 12px; cursor:pointer; transition: all 0.2s; }
        .l2-box:hover { border-color: var(--bd2); background: var(--sf3); }
        .l2-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; display:flex; align-items:center; gap:6px; }
        .l2-desc { font-size: 12px; color: var(--ink2); line-height: 1.4; }
        .l2-val { font-size: 24px; font-weight: 700; margin-top: 8px; }
        
        .l3-panel { background: var(--sf); border: 1px solid var(--bd); border-radius: 12px; padding: 16px; margin-top: 16px; animation: slideDown 0.3s ease; }
        @keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
      `}} />

      <div className="perf-inner">
        
        {/* 1. Obere Steuerung */}
        <div className="hd">
          <div className="ctrls">
            <div className="tabs">
              {(['Heute', 'Woche', 'Monat'] as const).map(period => (
                <button
                  key={period}
                  disabled={loadingPeriod !== null}
                  className={`tabb ${tab === period ? 'on' : ''}`}
                  onClick={() => void loadPeriod(period)}
                >
                  {loadingPeriod === period ? 'Lädt…' : period}
                </button>
              ))}
            </div>
            <div className="tsw">
              <button className={`tw ${theme === 'dark' ? 'on' : ''}`} onClick={() => toggleTheme('dark')}><Moon className="w-3 h-3"/> Dark</button>
              <button className={`tw ${theme === 'light' ? 'on' : ''}`} onClick={() => toggleTheme('light')}><Sun className="w-3 h-3"/> Hell</button>
            </div>
          </div>
        </div>
        <div className="stamp"><b>{overviews[0]?.periodLabel || tab}</b><span>·</span>Abfrage {loadedAtLabel}</div>
        {dataError && (
          <div role="alert" className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">
            {dataError}
          </div>
        )}
        <div className="mb-4 rounded-lg border border-[var(--bd)] bg-[var(--sf)] p-3 text-xs text-[var(--ink2)]">
          Historische Vergleiche bleiben deaktiviert, bis periodisierte Vergleichsreihen belastbar gespeichert sind.
        </div>

        {/* 2. KI-Kachel */}
        <div className="t-grid">
            <div className="t-tile ki-tile" style={{cursor:'default'}}>
              <div className="t-glow"></div>
              <div className="t-ico" style={{background: 'var(--posbg)'}}>
                <Sparkles className="w-5 h-5" style={{color: 'var(--pos)'}} />
              </div>
              <div className="t-th">
                <div className="t-tl" style={{gap:0}}>
                  <div>
                    <div className="t-name" style={{color: 'var(--pos)'}}>KI-Empfehlungen</div>
                    <div className="ki-hint">Noch nicht mit belastbarer, periodisierter Evidenz verbunden.</div>
                  </div>
                </div>
                <span className="t-pill t-pill-g">NICHT INSTRUMENTIERT</span>
              </div>
            </div>
        </div>

        {/* 3. Hauptkacheln */}
        <div className="t-grid">
          <WerkstattPulsKachel summary={overviews.find(o => o.key === 'werkstatt_puls')} onClick={() => setDrillTile('werkstatt_puls')} />
        </div>

        <div className="t-grid t-g2">
          <UmsatzMargeKachel summary={overviews.find(o => o.key === 'umsatz_marge')} onClick={() => setDrillTile('umsatz_marge')} />
          <QualitaetRisikoKachel summary={overviews.find(o => o.key === 'qualitaet_risiko')} onClick={() => setDrillTile('qualitaet_risiko')} />
          <BaederMaterialKachel summary={overviews.find(o => o.key === 'baeder_material')} onClick={() => setDrillTile('baeder_material')} />
          <KundenMarktKachel summary={overviews.find(o => o.key === 'kunden_markt')} onClick={() => setDrillTile('kunden_markt')} />
        </div>

        {/* F) Marketing & Kundenreaktivierung */}
        <div className="t-grid" style={{marginTop: 16}}>
          <MarketingWirkungKachel summary={overviews.find(o => o.key === 'marketing_reaktivierung')} onClick={() => setDrillTile('marketing_reaktivierung')} />
        </div>

      </div>
      
      {/* Drilldown Overlay */}
      {drillTile && (
        <AnalyseDrillOverlay 
          tileKey={drillTile} 
          period={tab} 
          onClose={() => setDrillTile(null)} 
        />
      )}
    </div>
  );
}
