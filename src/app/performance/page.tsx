"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AnalysisOverlay } from '@/components/ui/AnalysisOverlay';
import { 
  Moon, Sun, Sparkles, Activity, 
  TrendingUp, AlertTriangle, FlaskConical, Users,
  Banknote
} from 'lucide-react';

export default function PerformanceCockpit() {
  // Disable normal tracking since user requested: "App-Nutzungsanalyse bleibt NICHT auf /performance"
  // Actually we shouldn't even call usePageView if they don't want it, but the prompt says:
  // "Developer Analytics bleibt nur /admin/analytics."
  // I will omit usePageView entirely.
  
  
  const [perfData, setPerfData] = useState<any>({
    totalRevenue: 0, totalOrders: 0, completedOrders: 0, reklas: 0, activeWarnings: 0, durchlaufzeit: 0
  });

  useEffect(() => {
    import('./actions').then(({ getPerformanceKPIsAction }) => {
      getPerformanceKPIsAction().then(res => {
        if (res.ok && res.data) setPerfData(res.data);
      });
    });
  }, []);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [tab, setTab] = useState('Monat');
  const [cmpOn, setCmpOn] = useState(false);
  const [cmpPer, setCmpPer] = useState('vormonat');
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
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

  const getDeltaText = (rawDataset: string) => {
    if (!cmpOn) return null;
    const parts = rawDataset.split('|');
    for (const p of parts) {
      const [k, v] = p.split(':');
      if (k === cmpPer) return `${v} vs. ${cmpPer.charAt(0).toUpperCase() + cmpPer.slice(1)}`;
    }
    return null;
  };

  return (
    <div className={`perf-wrapper ${theme === 'light' ? 'light' : ''}`}>
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
              {['Woche', 'Monat', 'Quartal', 'Jahr'].map(t => (
                <button key={t} className={`tabb ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            <div className="tsw">
              <button className={`tw ${theme === 'dark' ? 'on' : ''}`} onClick={() => toggleTheme('dark')}><Moon className="w-3 h-3"/> Dark</button>
              <button className={`tw ${theme === 'light' ? 'on' : ''}`} onClick={() => toggleTheme('light')}><Sun className="w-3 h-3"/> Hell</button>
            </div>
          </div>
        </div>
        <div className="stamp"><b>Mai 2026</b><span>·</span>Stand 09:14<span>·</span>22 Werktage · 5 MA</div>

        <div className="cmp-row">
          <button className={`cmp-btn ${cmpOn ? 'active' : ''}`} onClick={() => setCmpOn(!cmpOn)}>
            <TrendingUp className="w-4 h-4" />
            Zeig mir die Veränderungen zu
          </button>
          <div className="cmp-dd">
            {['vorwoche', 'vormonat', 'vorquartal', 'vorjahr'].map(p => (
              <button key={p} className={`cmp-opt ${cmpPer === p ? 'on' : ''}`} onClick={() => { setCmpPer(p); setCmpOn(true); }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div className={`cmp-lbl ${cmpOn ? 'show' : ''}`}>
            <span>Vergleich: {cmpPer.charAt(0).toUpperCase() + cmpPer.slice(1)}</span>
            <span className="cmp-x" onClick={() => setCmpOn(false)}>✕</span>
          </div>
        </div>

        {/* 2. KI-Kachel */}
        <div className="t-grid">
          <Link href="/performance/ki-empfehlungen" style={{textDecoration:'none',color:'inherit'}}>
            <div className="t-tile ki-tile">
              <div className="t-glow"></div>
              <div className="t-ico" style={{background: 'var(--posbg)'}}>
                <Sparkles className="w-5 h-5" style={{color: 'var(--pos)'}} />
              </div>
              <div className="t-th">
                <div className="t-tl" style={{gap:0}}>
                  <div>
                    <div className="t-name" style={{color: 'var(--pos)'}}>Was kann ich besser machen?</div>
                    <div className="ki-hint">KI-Analyse · Tipps · Handlungsempfehlungen für alle Bereiche</div>
                  </div>
                </div>
                <span className="t-pill t-pill-g">6 TIPPS</span>
              </div>
              <div className="t-arr" style={{opacity:1, color:'var(--pos)'}}>Ansehen →</div>
            </div>
          </Link>
        </div>

        {/* 3. Hauptkacheln */}
        <div className="t-grid">
          {/* A) Werkstatt-Puls */}
          <div onClick={(e) => { e.preventDefault(); setActiveOverlay('werkstatt-puls'); }} style={{textDecoration:'none',color:'inherit', cursor:'pointer'}}>
          <div className="t-tile t-hero">
            <div className="t-glow" style={{background: '#22D3EE'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'rgba(34,211,238,.12)'}}>
                  <Activity className="w-5 h-5" style={{color: 'var(--cyan)'}} />
                </div>
                <div><div className="t-name">Werkstatt-Puls</div><div className="t-sub">Durchsatz · Stationen · Wochenziel</div></div>
              </div>
              <span className="t-pill t-pill-y">HANDLUNGSBEDARF</span>
            </div>
            <div className="hero-body">
              <div className="hero-left">
                <div className="metrics">
                  <div className="m">
                    <div className="ml">Termintreue</div><div className="mv neg">76 %</div><div className="md neg">▼ −9 Pkt. vs. Vj.</div>
                    <div className={`delta d-neg ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:−4 Pkt.|vorwoche:−2 Pkt.|vorquartal:−7 Pkt.|vorjahr:−9 Pkt.')}</div>
                  </div>
                  <div className="m">
                    <div className="ml">Ø Durchlaufzeit</div><div className="mv warn">9,4 T</div><div className="md warn">▲ +1,2 T vs. Vj.</div>
                    <div className={`delta d-warn ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+0,6 Tage|vorwoche:+0,2 Tage|vorquartal:+1,0 Tage|vorjahr:+1,2 Tage')}</div>
                  </div>
                  <div className="m">
                    <div className="ml">Wochenziel</div><div className="mv">23<span style={{fontSize:'14px',fontWeight:400,color:'var(--ink2)'}}> / 25</span></div>
                    <div className="wgoal">
                      <div className="wprog"><div className="wpf" style={{width: '92%'}}></div></div>
                      <span style={{fontSize:'10px',fontWeight:600,color:'var(--pos)'}}>92%</span>
                    </div>
                    <div className={`delta d-pos ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+3 mehr|vorwoche:+1 mehr|vorquartal:+5 mehr|vorjahr:+2 mehr')}</div>
                  </div>
                </div>
                <div className="mbars">
                  <div className="mbar"><div className="mbar-f" style={{background: 'linear-gradient(to top,var(--neg),#fb7185)', height: '94%'}}></div></div>
                  <div className="mbar"><div className="mbar-f" style={{background: 'linear-gradient(to top,var(--warn),#fcd34d)', height: '78%'}}></div></div>
                  <div className="mbar"><div className="mbar-f" style={{background: 'linear-gradient(to top,var(--pos),#6ee7b7)', height: '62%'}}></div></div>
                  <div className="mbar"><div className="mbar-f" style={{background: 'linear-gradient(to top,var(--pos),#6ee7b7)', height: '54%'}}></div></div>
                  <div className="mbar"><div className="mbar-f" style={{background: 'linear-gradient(to top,var(--info),#93c5fd)', height: '41%'}}></div></div>
                </div>
                <div className="mbar-labels"><span>Schleifen</span><span>Politur</span><span>Galvanik</span><span>Vorber.</span><span>QK/Vers.</span></div>
              </div>
              <div style={{display:'flex', alignItems:'center'}}>
                <div className="ring">
                  <svg width="80" height="80" viewBox="0 0 80 80" style={{transform:'rotate(-90deg)'}}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#A78BFA"/>
                      </linearGradient>
                    </defs>
                    <circle cx="40" cy="40" r="32" fill="none" stroke="var(--bd)" strokeWidth="6"/>
                    <circle cx="40" cy="40" r="32" fill="none" stroke="url(#rg)" strokeWidth="6" strokeLinecap="round" strokeDasharray="201" strokeDashoffset={201 * (1 - 0.64)}/>
                  </svg>
                  <div className="rval">64%</div>
                </div>
              </div>
            </div>
            <div className="t-arr">Details →</div>
          </div>
          </div>
        </div>

        <div className="t-grid t-g2">
          {/* B) Umsatz und Marge */}
          <div onClick={(e) => { e.preventDefault(); setActiveOverlay('umsatz-marge'); }} style={{textDecoration:'none',color:'inherit', cursor:'pointer'}}>
          <div className="t-tile">
            <div className="t-glow" style={{background: '#34D399'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'var(--posbg)'}}><Banknote className="w-5 h-5" style={{color: 'var(--pos)'}} /></div>
                <div><div className="t-name">Umsatz und Marge</div><div className="t-sub">Finanzen · Forecast · Controlling</div></div>
              </div>
              <span className="t-pill t-pill-g">STABIL</span>
            </div>
            <div className="metrics">
              <div className="m">
                <div className="ml">Umsatz netto</div><div className="mv">{perfData.totalRevenue.toLocaleString("de-DE")} €</div><div className="md pos">▲ +7,2% vs. Vj.</div>
                <div className={`delta d-pos ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+3.120 €|vorwoche:+820 €|vorquartal:+4.580 €|vorjahr:+2.860 €')}</div>
              </div>
              <div className="m">
                <div className="ml">Deckungsbeitrag</div><div className="mv sm">{(perfData.totalRevenue * 0.279).toLocaleString("de-DE")} €</div><div className="md" style={{color: "var(--ink2)"}}>{perfData.totalRevenue > 0 ? "27,9% Marge" : "0% Marge"}</div>
                <div className={`delta d-pos ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+940 €|vorwoche:+210 €|vorquartal:+1.240 €|vorjahr:+680 €')}</div>
              </div>
            </div>
            <div className="spk">
              <svg viewBox="0 0 140 28" width="140" height="28">
                <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--pos)" stopOpacity="0.22"/><stop offset="100%" stopColor="var(--pos)" stopOpacity="0"/></linearGradient></defs>
                <path d="M0,22 L16,19 L32,20 L48,16 L64,14 L80,13 L96,11 L112,10 L128,7 L140,5 L140,28 L0,28 Z" fill="url(#sg)"/>
                <polyline points="0,22 16,19 32,20 48,16 64,14 80,13 96,11 112,10 128,7 140,5" fill="none" stroke="var(--pos)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="t-arr">Details →</div>
          </div>
          </div>

          {/* C) Qualität und Risiko */}
          <div onClick={(e) => { e.preventDefault(); setActiveOverlay('qualitaet-risiko'); }} style={{textDecoration:'none',color:'inherit', cursor:'pointer'}}>
          <div className="t-tile">
            <div className="t-glow" style={{background: '#FBBF24'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'var(--warnbg)'}}><AlertTriangle className="w-5 h-5" style={{color: 'var(--warn)'}} /></div>
                <div><div className="t-name">Qualität und Risiko</div><div className="t-sub">Reklamationen · Frühwarnungen</div></div>
              </div>
              <span className="t-pill t-pill-y">2 AKTIV</span>
            </div>
            <div className="metrics">
              <div className="m">
                <div className="ml">Reklamationen</div><div className="mv warn">{perfData.reklas} <span style={{fontSize:"13px",fontWeight:400,color:"var(--ink2)"}}>von {perfData.totalOrders}</span></div><div className="md neg">▲ +1 vs. Vj. · 7,1%</div>
                <div className={`delta d-neg ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+1 mehr|vorwoche:±0|vorquartal:+1 mehr|vorjahr:+1 mehr')}</div>
              </div>
              <div className="m">
                <div className="ml">Frühwarnungen</div><div className="mv sm neg">{perfData.activeWarnings} aktiv</div><div className="md" style={{color: 'var(--ink2)'}}>Nickelbad: 4 Tage</div>
                <div className={`delta d-warn ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:neu|vorwoche:neu|vorquartal:+1 neu|vorjahr:+1 neu')}</div>
              </div>
            </div>
            <div className="alertbox" style={{background: 'var(--negbg)'}}>
              <span style={{fontWeight:600}}>A-2026-0042:</span> 0% Risiko · 0 Kunden überfällig (0 €)
            </div>
            <div className="t-arr">Details →</div>
          </div>
          </div>

          {/* D) Bäder und Material */}
          <Link href="/performance/baeder-material" style={{textDecoration:'none',color:'inherit'}}>
          <div className="t-tile">
            <div className="t-glow" style={{background: '#FBBF24'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'var(--warnbg)'}}><FlaskConical className="w-5 h-5" style={{color: 'var(--warn)'}} /></div>
                <div><div className="t-name">Bäder und Material</div><div className="t-sub">Metallpreise · Einkauf · Marge</div></div>
              </div>
              <span className="t-pill t-pill-y">1 BEOBACHTEN</span>
            </div>
            <div className="metrics">
              <div className="m">
                <div className="ml">Metall-Marge (Mai)</div><div className="mv pos">0 €</div><div className="md pos">Gold +14% seit Badkauf</div>
                <div className={`delta d-pos ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+620 €|vorwoche:+180 €|vorquartal:+1.240 €|vorjahr:+2.100 €')}</div>
              </div>
              <div className="m">
                <div className="ml">Einkauf-Ergebnis</div><div className="mv sm pos">0 €</div><div className="md" style={{color: 'var(--ink2)'}}>Marktwert &gt; Einkauf</div>
                <div className={`delta d-pos ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+380 €|vorwoche:+90 €|vorquartal:+840 €|vorjahr:0 €')}</div>
              </div>
            </div>
            <div className="chips">
              <div className="chip"><span className="cdot" style={{background: '#FBBF24'}}></span>Gold 68,40</div>
              <div className="chip"><span className="cdot" style={{background: '#94A3B8'}}></span>Silber 0,98</div>
              <div className="chip"><span className="cdot" style={{background: '#D97706'}}></span>Kupfer 8,78/kg</div>
              <div className="chip"><span className="cdot" style={{background: '#86EFAC'}}></span>Nickel 15,90/kg</div>
            </div>
            <div className="t-arr">Details →</div>
          </div>
          </Link>

          {/* E) Kunden und Markt */}
          <Link href="/performance/kunden-markt" style={{textDecoration:'none',color:'inherit'}}>
          <div className="t-tile">
            <div className="t-glow" style={{background: '#60A5FA'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'var(--infobg)'}}><Users className="w-5 h-5" style={{color: 'var(--info)'}} /></div>
                <div><div className="t-name">Kunden und Markt</div><div className="t-sub">CLV · Zahlung · Regionen</div></div>
              </div>
              <span className="t-pill t-pill-g">STABIL</span>
            </div>
            <div className="metrics">
              <div className="m">
                <div className="ml">Top-Kunde</div><div className="mv sm">Museum Lenzburg</div><div className="md" style={{color: 'var(--ink2)'}}>0 € · CLV 0 €</div>
                <div className={`delta d-neutral ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:unverändert|vorwoche:unverändert|vorquartal:neu in Top 1|vorjahr:unverändert')}</div>
              </div>
              <div className="m">
                <div className="ml">Zahlungsmoral</div><div className="mv sm pos">Ø 18 T</div><div className="md" style={{color: 'var(--ink2)'}}>82% pünktlich</div>
                <div className={`delta d-pos ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:−2 T besser|vorwoche:−1 T|vorquartal:−3 T|vorjahr:−4 T besser')}</div>
              </div>
            </div>
            <div className="custrow"><span>🚗 82% Abholung</span><span>📦 18% Versand</span><span>🌍 3 Länder</span></div>
            <div className="t-arr">Details →</div>
          </div>
          </Link>

        </div>

        {/* F) Marketing & Kundenreaktivierung */}
        <div className="t-grid" style={{marginTop: 16}}>
          <Link href="/marketing" style={{textDecoration:'none',color:'inherit'}}>
          <div className="t-tile" style={{borderColor: 'rgba(251,191,36,0.3)'}}>
            <div className="t-glow" style={{background: '#FBBF24'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'var(--warnbg)'}}><Sparkles className="w-5 h-5" style={{color: 'var(--warn)'}} /></div>
                <div><div className="t-name">Marketing & Kundenreaktivierung</div><div className="t-sub">Kandidaten · Segmente · Umsatzpotenzial</div></div>
              </div>
              <span className="t-pill t-pill-y">DEMO-DATEN</span>
            </div>
            <div className="metrics">
              <div className="m">
                <div className="ml">Reaktivierungskandidaten</div><div className="mv warn">6</div><div className="md" style={{color: 'var(--ink2)'}}>Kunden ohne Folgeauftrag &gt; 6 Mon.</div>
              </div>
              <div className="m">
                <div className="ml">Segmentpotenzial</div><div className="mv sm">Oldtimer / Schmuck</div><div className="md" style={{color: 'var(--ink2)'}}>Stärkste Segmente</div>
              </div>
              <div className="m">
                <div className="ml">Reaktivierungswirkung</div><div className="mv sm" style={{color: 'var(--ink3)'}}>– %</div><div className="md" style={{color: 'var(--ink3)'}}>Noch keine Kampagne gestartet</div>
              </div>
              <div className="m">
                <div className="ml">Marge-Potenzial</div><div className="mv sm" style={{color: 'var(--ink3)'}}>– €</div><div className="md" style={{color: 'var(--ink3)'}}>Echte Kampagnendaten fehlen</div>
              </div>
            </div>
            <div className="alertbox" style={{background: 'var(--warnbg)', fontSize: '10px', fontWeight: 500}}>
              ⚠ Daten basieren auf Bestandskunden-Analyse (Demo). Echte Kampagnendaten werden erst nach E-Mail-Integration verfügbar.
            </div>
            <div className="t-arr">Zum Marketing-Cockpit →</div>
          </div>
          </Link>
        </div>

      </div>

      {/* 7-Ebenen Overlays */}
      <AnalysisOverlay
        open={activeOverlay === 'werkstatt-puls'}
        onClose={() => setActiveOverlay(null)}
        title="Werkstatt-Puls Detail"
        subtitle="Durchsatz, Stationen und Wochenziel im Detail."
        hero={{
          kicker: "Wochenziel",
          value: "23 / 25",
          changePill: { text: "92% erreicht", variant: "teal" }
        }}
        composition={{
          title: "Stations-Status",
          rows: [
            { avatar: "G", avatarColor: "bg-error-red", name: "Galvanik", amount: "62% Durchsatz", href: "/baeder" },
            { avatar: "P", avatarColor: "bg-warning-yellow", name: "Politur", amount: "78% Durchsatz", href: "/station/politur" }
          ]
        }}
        insight={{
          body: "Die Galvanik-Station ist der aktuelle Flaschenhals. Kapazitäten prüfen."
        }}
        linkedAreas={[
          { label: "Bäder-Status", href: "/baeder" },
          { label: "Warendurchlauf", href: "/warendurchlauf" }
        ]}
      />

      <AnalysisOverlay
        open={activeOverlay === 'umsatz-marge'}
        onClose={() => setActiveOverlay(null)}
        title="Umsatz und Marge Detail"
        subtitle="Finanzen, Forecast und Controlling."
        hero={{
          kicker: "Umsatz netto",
          value: "{perfData.totalRevenue.toLocaleString("de-DE")} €",
          changePill: { text: "+7.2% vs. Vj.", variant: "teal" }
        }}
        composition={{
          title: "Top Umsatzträger",
          rows: [
            { avatar: "A", avatarColor: "bg-navy-900", name: "Auto AG", amount: "0 €", href: "/customers/1" },
            { avatar: "S", avatarColor: "bg-navy-900", name: "Stahlbau GmbH", amount: "0 €", href: "/customers/2" }
          ]
        }}
        insight={{
          body: "Marge liegt stabil bei 27,9%. Deckungsbeitrag steigt durch verbesserte Materialnutzung."
        }}
        linkedAreas={[
          { label: "Kunden", href: "/customers" },
          { label: "Rechnungen", href: "/buchhaltung/rechnungen" }
        ]}
      />

      <AnalysisOverlay
        open={activeOverlay === 'qualitaet-risiko'}
        onClose={() => setActiveOverlay(null)}
        title="Qualität und Risiko Detail"
        subtitle="Reklamationen und Frühwarnungen."
        hero={{
          kicker: "Reklamationen",
          value: "{perfData.reklas}",
          changePill: { text: "Fehlerquote 7.1%", variant: "red" }
        }}
        composition={{
          title: "Aktuelle Fälle",
          rows: [
            { avatar: "B", avatarColor: "bg-error-red", name: "Bad 3 (Oberfläche)", amount: "A-2026-0044", href: "/orders/1" },
            { avatar: "V", avatarColor: "bg-warning-yellow", name: "Verpackung (Transportschaden)", amount: "A-2026-0081", href: "/orders/2" }
          ]
        }}
        insight={{
          body: "Die Risiko-Quote (84%) betrifft 0 Kunden mit überfälligen Lieferungen im Wert von 0 €."
        }}
        linkedAreas={[
          { label: "Kontrolle & QS", href: "/kontrolle" },
          { label: "Reklamationen", href: "/orders" }
        ]}
      />
    </div>
  );
}
