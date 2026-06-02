"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DetailOverlay } from '@/components/ui/DetailOverlay';
import { 
  Search, Moon, Sun, ChevronDown, Sparkles, Activity, 
  TrendingUp, AlertTriangle, FlaskConical, Users, ArrowRight,
  Target, Zap, AlertOctagon, TrendingDown, Clock, ShieldCheck,
  CheckCircle2, AlertCircle, BarChart3, Factory, HeartHandshake, Banknote, Map
} from 'lucide-react';
import { usePageView } from '@/hooks/usePageView';

export default function PerformanceCockpit() {
  // Disable normal tracking since user requested: "App-Nutzungsanalyse bleibt NICHT auf /performance"
  // Actually we shouldn't even call usePageView if they don't want it, but the prompt says:
  // "Developer Analytics bleibt nur /admin/analytics."
  // I will omit usePageView entirely.
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [tab, setTab] = useState('Monat');
  const [cmpOn, setCmpOn] = useState(false);
  const [cmpPer, setCmpPer] = useState('vormonat');
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [level3State, setLevel3State] = useState<string | null>(null);

  // Sync theme
  useEffect(() => {
    const saved = localStorage.getItem('perfTheme');
    if (saved === 'dark' || saved === 'light') setTheme(saved);
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

  const openOverlay = (id: string) => {
    setActiveOverlay(id);
    setLevel3State(null); // reset level 3
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
          <div className="t-tile ki-tile" onClick={() => openOverlay('ki')}>
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
              <span className="t-pill t-pill-g">4 TIPPS</span>
            </div>
            <div className="t-arr" style={{opacity:1, color:'var(--pos)'}}>Ansehen →</div>
          </div>
        </div>

        {/* 3. Hauptkacheln */}
        <div className="t-grid">
          {/* A) Werkstatt-Puls */}
          <div className="t-tile t-hero" onClick={() => openOverlay('werkstatt')}>
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

        <div className="t-grid t-g2">
          {/* B) Umsatz & Marge */}
          <div className="t-tile" onClick={() => openOverlay('umsatz')}>
            <div className="t-glow" style={{background: '#34D399'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'var(--posbg)'}}><Banknote className="w-5 h-5" style={{color: 'var(--pos)'}} /></div>
                <div><div className="t-name">Umsatz & Marge</div><div className="t-sub">Finanzen · Forecast · Controlling</div></div>
              </div>
              <span className="t-pill t-pill-g">STABIL</span>
            </div>
            <div className="metrics">
              <div className="m">
                <div className="ml">Umsatz netto</div><div className="mv">42.380 €</div><div className="md pos">▲ +7,2% vs. Vj.</div>
                <div className={`delta d-pos ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+3.120 €|vorwoche:+820 €|vorquartal:+4.580 €|vorjahr:+2.860 €')}</div>
              </div>
              <div className="m">
                <div className="ml">Deckungsbeitrag</div><div className="mv sm">11.840 €</div><div className="md" style={{color: 'var(--ink2)'}}>27,9% Marge</div>
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

          {/* C) Qualität & Risiko */}
          <div className="t-tile" onClick={() => openOverlay('qualitaet')}>
            <div className="t-glow" style={{background: '#FBBF24'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'var(--warnbg)'}}><AlertTriangle className="w-5 h-5" style={{color: 'var(--warn)'}} /></div>
                <div><div className="t-name">Qualität & Risiko</div><div className="t-sub">Reklamationen · Frühwarnungen</div></div>
              </div>
              <span className="t-pill t-pill-y">2 AKTIV</span>
            </div>
            <div className="metrics">
              <div className="m">
                <div className="ml">Reklamationen</div><div className="mv warn">2 <span style={{fontSize:'13px',fontWeight:400,color:'var(--ink2)'}}>von 28</span></div><div className="md neg">▲ +1 vs. Vj. · 7,1%</div>
                <div className={`delta d-neg ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+1 mehr|vorwoche:±0|vorquartal:+1 mehr|vorjahr:+1 mehr')}</div>
              </div>
              <div className="m">
                <div className="ml">Frühwarnungen</div><div className="mv sm neg">1 aktiv</div><div className="md" style={{color: 'var(--ink2)'}}>Nickelbad: 4 Tage</div>
                <div className={`delta d-warn ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:neu|vorwoche:neu|vorquartal:+1 neu|vorjahr:+1 neu')}</div>
              </div>
            </div>
            <div className="alertbox" style={{background: 'var(--negbg)'}}>
              <span style={{fontWeight:600}}>A-2026-0042:</span> 84% Risiko · 6 Kunden überfällig (11.200 €)
            </div>
            <div className="t-arr">Details →</div>
          </div>

          {/* D) Bäder & Material */}
          <div className="t-tile" onClick={() => openOverlay('baeder')}>
            <div className="t-glow" style={{background: '#FBBF24'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'var(--warnbg)'}}><FlaskConical className="w-5 h-5" style={{color: 'var(--warn)'}} /></div>
                <div><div className="t-name">Bäder & Material</div><div className="t-sub">Metallpreise · Einkauf · Marge</div></div>
              </div>
              <span className="t-pill t-pill-y">1 BEOBACHTEN</span>
            </div>
            <div className="metrics">
              <div className="m">
                <div className="ml">Metall-Marge (Mai)</div><div className="mv pos">+2.840 €</div><div className="md pos">Gold +14% seit Badkauf</div>
                <div className={`delta d-pos ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+620 €|vorwoche:+180 €|vorquartal:+1.240 €|vorjahr:+2.100 €')}</div>
              </div>
              <div className="m">
                <div className="ml">Einkauf-Ergebnis</div><div className="mv sm pos">+1.640 €</div><div className="md" style={{color: 'var(--ink2)'}}>Marktwert &gt; Einkauf</div>
                <div className={`delta d-pos ${cmpOn ? 'show' : ''}`}>{getDeltaText('vormonat:+380 €|vorwoche:+90 €|vorquartal:+840 €|vorjahr:+1.640 €')}</div>
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

          {/* E) Kunden & Markt */}
          <div className="t-tile" onClick={() => openOverlay('kunden')}>
            <div className="t-glow" style={{background: '#60A5FA'}}></div>
            <div className="t-th">
              <div className="t-tl">
                <div className="t-ico" style={{background: 'var(--infobg)'}}><Users className="w-5 h-5" style={{color: 'var(--info)'}} /></div>
                <div><div className="t-name">Kunden & Markt</div><div className="t-sub">CLV · Zahlung · Regionen</div></div>
              </div>
              <span className="t-pill t-pill-g">STABIL</span>
            </div>
            <div className="metrics">
              <div className="m">
                <div className="ml">Top-Kunde</div><div className="mv sm">Museum Lenzburg</div><div className="md" style={{color: 'var(--ink2)'}}>5.840 € · CLV 18.400 €</div>
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

        </div>
      </div>

      {/* OVERLAYS (Level 2 + 3) */}
      
      {/* KI Overlay */}
      <DetailOverlay open={activeOverlay === 'ki'} onClose={() => setActiveOverlay(null)} title="Was kann ich besser machen? (KI)">
        <div style={{color: 'var(--ink)'}}>
          <p style={{marginBottom: 16, color: 'var(--ink2)'}}>Die KI hat basierend auf den Echtzeitdaten 4 Handlungsempfehlungen generiert:</p>
          
          <div className="l2-box" onClick={() => setLevel3State(level3State === 'ki1' ? null : 'ki1')}>
            <div className="l2-title"><AlertTriangle className="w-4 h-4 text-warn" style={{color:'var(--warn)'}}/> Nickelbad-Wartung vorziehen</div>
            <div className="l2-desc">Ausschussquote beim Vernickeln um 2% gestiegen.</div>
            {level3State === 'ki1' && (
              <div className="l3-panel">
                <p><strong>Signal:</strong> Abfall der PH-Werte in Schicht 2 gemeldet.</p>
                <p style={{marginTop:4}}><strong>Ursache:</strong> Dosieranlage filtert nicht optimal.</p>
                <p style={{marginTop:4}}><strong>Maßnahme:</strong> Wartung dieses Wochenende durchführen.</p>
                <div style={{marginTop: 12, display:'flex', gap:8, flexWrap:'wrap'}}>
                  <Link href="/baeder" className="cmp-btn">Bäder-Management</Link>
                  <Link href="/kontrolle" className="cmp-btn">Qualitätskontrolle</Link>
                </div>
              </div>
            )}
          </div>

          <div className="l2-box" onClick={() => setLevel3State(level3State === 'ki2' ? null : 'ki2')}>
            <div className="l2-title"><Target className="w-4 h-4 text-pos" style={{color:'var(--pos)'}}/> Kapazität für Express-Aufträge frei</div>
            <div className="l2-desc">Vorarbeit (Schleifen) unterausgelastet.</div>
            {level3State === 'ki2' && (
              <div className="l3-panel">
                <p><strong>Signal:</strong> Maschinenstillstand 18% über Normalmaß in Station 1.</p>
                <p style={{marginTop:4}}><strong>Ursache:</strong> Großkunde hat Lieferung um 2 Tage verzögert.</p>
                <p style={{marginTop:4}}><strong>Maßnahme:</strong> 15% Express-Kontingent freigeben und Kunden informieren.</p>
                <div style={{marginTop: 12, display:'flex', gap:8, flexWrap:'wrap'}}>
                  <Link href="/warendurchlauf" className="cmp-btn">Warendurchlauf</Link>
                  <Link href="/orders" className="cmp-btn">Auftragsbuch</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </DetailOverlay>

      {/* Werkstatt Puls Overlay */}
      <DetailOverlay open={activeOverlay === 'werkstatt'} onClose={() => setActiveOverlay(null)} title="Werkstatt-Puls">
        <div style={{color: 'var(--ink)'}}>
          
          <div className="l2-box" onClick={() => setLevel3State(level3State === 'w1' ? null : 'w1')}>
            <div className="l2-title"><Activity className="w-4 h-4" /> Stationsauslastung & Engpässe</div>
            <div className="l2-desc">Schleifen bei 94% Auslastung, Vorbereitung 41%.</div>
            
            <div style={{marginTop:12, display:'flex', gap:6, flexDirection:'column'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:10}}><span style={{width:60}}>Schleifen</span><div style={{flex:1, height:6, background:'var(--bd)', borderRadius:3}}><div style={{width:'94%', height:'100%', background:'var(--neg)', borderRadius:3}}></div></div><span>94%</span></div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:10}}><span style={{width:60}}>Politur</span><div style={{flex:1, height:6, background:'var(--bd)', borderRadius:3}}><div style={{width:'78%', height:'100%', background:'var(--warn)', borderRadius:3}}></div></div><span>78%</span></div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:10}}><span style={{width:60}}>Galvanik</span><div style={{flex:1, height:6, background:'var(--bd)', borderRadius:3}}><div style={{width:'62%', height:'100%', background:'var(--pos)', borderRadius:3}}></div></div><span>62%</span></div>
            </div>

            {level3State === 'w1' && (
              <div className="l3-panel">
                <p><strong>Betroffene Aufträge (Engpass Schleifen):</strong> 14 Aufträge stauen sich.</p>
                <p style={{marginTop:4, color:'var(--warn)'}}>Termintreue sinkt von 85% auf 76% (Trend: negativ).</p>
                <div style={{marginTop: 12, display:'flex', gap:8, flexWrap:'wrap'}}>
                  <Link href="/warendurchlauf" className="cmp-btn">Warendurchlauf</Link>
                  <Link href="/orders" className="cmp-btn">Auftragsbuch</Link>
                </div>
              </div>
            )}
          </div>
          
          <div className="l2-box" onClick={() => setLevel3State(level3State === 'w2' ? null : 'w2')}>
            <div className="l2-title"><Clock className="w-4 h-4" /> Durchlaufzeit & Wochenziel</div>
            <div className="l2-desc">Ø 9,4 Tage / 23 von 25 Chargen erreicht (92%).</div>
            {level3State === 'w2' && (
              <div className="l3-panel">
                <p><strong>Ursache für Verzögerung:</strong> Erhöhter Anteil an Sonderbearbeitungen (z.B. Polieren vor Galvanik).</p>
                <div style={{marginTop: 12, display:'flex', gap:8}}>
                  <Link href="/kontrolle" className="cmp-btn">Qualitätskontrolle</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </DetailOverlay>

      {/* Umsatz & Marge Overlay */}
      <DetailOverlay open={activeOverlay === 'umsatz'} onClose={() => setActiveOverlay(null)} title="Umsatz & Marge">
        <div style={{color: 'var(--ink)'}}>
          <div className="l2-box" onClick={() => setLevel3State(level3State === 'u1' ? null : 'u1')}>
            <div className="l2-title"><Banknote className="w-4 h-4" /> Umsatz, Deckungsbeitrag & Kalkulation</div>
            <div className="l2-desc">42.380 € Umsatz (+7.2%). DB liegt bei 11.840 € (27.9% Marge).</div>
            
            <div style={{marginTop:12, display:'flex', alignItems:'flex-end', gap:4, height:40}}>
              <div style={{flex:1, background:'var(--info)', height:'60%', borderRadius:'2px 2px 0 0'}}></div>
              <div style={{flex:1, background:'var(--info)', height:'75%', borderRadius:'2px 2px 0 0'}}></div>
              <div style={{flex:1, background:'var(--info)', height:'80%', borderRadius:'2px 2px 0 0'}}></div>
              <div style={{flex:1, background:'var(--pos)', height:'100%', borderRadius:'2px 2px 0 0'}}></div>
            </div>

            {level3State === 'u1' && (
              <div className="l3-panel">
                <p><strong>Fixkosten:</strong> 18.500 € | <strong>Variable Kosten:</strong> 12.040 €</p>
                <p style={{marginTop:4}}>Kalkulationsabweichung: +2,1% (positiv) durch gesunkene Energiekosten.</p>
                <div style={{marginTop: 12, display:'flex', gap:8, flexWrap:'wrap'}}>
                  <Link href="/finanzen" className="cmp-btn">Finanz-Dashboard</Link>
                </div>
              </div>
            )}
          </div>
          
          <div className="l2-box" onClick={() => setLevel3State(level3State === 'u2' ? null : 'u2')}>
            <div className="l2-title"><TrendingUp className="w-4 h-4" /> Forecast Q3 & Export</div>
            <div className="l2-desc">Erwarteter Umsatz: 145.000 €. Wahrscheinlichkeit: 85%.</div>
            {level3State === 'u2' && (
              <div className="l3-panel">
                <p><strong>Buchhaltungshinweis:</strong> 4 Rechnungen überfällig, DATEV-Export bereit.</p>
                <div style={{marginTop: 12, display:'flex', gap:8}}>
                  <Link href="/finanzen" className="cmp-btn">Buchhaltung / Mahnwesen</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </DetailOverlay>

      {/* Qualität & Risiko Overlay */}
      <DetailOverlay open={activeOverlay === 'qualitaet'} onClose={() => setActiveOverlay(null)} title="Qualität & Risiko">
        <div style={{color: 'var(--ink)'}}>
          <div className="l2-box" onClick={() => setLevel3State(level3State === 'q1' ? null : 'q1')}>
            <div className="l2-title"><ShieldCheck className="w-4 h-4" /> Reklamationen (2 Aktive) & Ursachen</div>
            <div className="l2-desc">7,1% Fehlerquote. Ursache primär Station 3 (Verzinken).</div>
            
            <div style={{marginTop:12, height:16, display:'flex', borderRadius:4, overflow:'hidden', border:'1px solid var(--bd)'}}>
              <div style={{width:'80%', background:'var(--pos)', fontSize:9, color:'#fff', paddingLeft:4, lineHeight:'16px'}}>OK (92.9%)</div>
              <div style={{width:'20%', background:'var(--neg)', fontSize:9, color:'#fff', textAlign:'right', paddingRight:4, lineHeight:'16px'}}>NOK (7.1%)</div>
            </div>

            {level3State === 'q1' && (
              <div className="l3-panel">
                <p><strong>Reklamationsursachen:</strong> Oberflächenqualität mangelhaft (Pickelbildung).</p>
                <p style={{marginTop:4}}><strong>Betroffene Stationen:</strong> Galvanik-Zink (Bad 2).</p>
                <div style={{marginTop: 12, display:'flex', gap:8, flexWrap:'wrap'}}>
                  <Link href="/kontrolle" className="cmp-btn">Qualitätskontrolle</Link>
                  <Link href="/kundenservice" className="cmp-btn">Kundenservice</Link>
                </div>
              </div>
            )}
          </div>

          <div className="l2-box" onClick={() => setLevel3State(level3State === 'q2' ? null : 'q2')}>
            <div className="l2-title"><AlertTriangle className="w-4 h-4" /> Risikoaufträge & Kommunikation</div>
            <div className="l2-desc">A-2026-0042 (84% Risiko) - 6 Kunden überfällig.</div>
            {level3State === 'q2' && (
              <div className="l3-panel">
                <p><strong>Kommunikationsrisiken:</strong> Kunde "Autohaus Berger" wartet seit 3 Tagen auf Antwort.</p>
                <div style={{marginTop: 12, display:'flex', gap:8}}>
                  <Link href="/kommunikation" className="cmp-btn">Kommunikations-Center</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </DetailOverlay>

      {/* Bäder & Material Overlay */}
      <DetailOverlay open={activeOverlay === 'baeder'} onClose={() => setActiveOverlay(null)} title="Bäder & Material">
        <div style={{color: 'var(--ink)'}}>
          <div className="l2-box" onClick={() => setLevel3State(level3State === 'b1' ? null : 'b1')}>
            <div className="l2-title"><FlaskConical className="w-4 h-4" /> Badstatus & Kritische Bäder</div>
            <div className="l2-desc">1 Bad unter Beobachtung (Nickel). 8 Bäder im grünen Bereich.</div>
            {level3State === 'b1' && (
              <div className="l3-panel">
                <p><strong>Nickelbad 1:</strong> PH-Wert grenzwertig (Toleranz -0.2).</p>
                <p style={{marginTop:4}}><strong>Chemiebestand:</strong> Salzsäure reicht noch für 4 Tage (Nachbestellung fällig).</p>
                <div style={{marginTop: 12, display:'flex', gap:8, flexWrap:'wrap'}}>
                  <Link href="/baeder" className="cmp-btn">Bäder-Management</Link>
                  <Link href="/items" className="cmp-btn">Lager / Chemie</Link>
                </div>
              </div>
            )}
          </div>

          <div className="l2-box" onClick={() => setLevel3State(level3State === 'b2' ? null : 'b2')}>
            <div className="l2-title"><BarChart3 className="w-4 h-4" /> Metallverbrauch & Marge</div>
            <div className="l2-desc">Goldmarge stark positiv (+2.840 €). Tagespreis 68,40 €/g.</div>
            
            <div style={{marginTop:12, padding:8, background:'var(--sf)', borderRadius:8, fontSize:10}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Gold EK-Preis</span> <span>60.00 €/g</span></div>
              <div style={{display:'flex', justifyContent:'space-between', color:'var(--pos)', fontWeight:600}}><span>Gold Tagespreis</span> <span>68.40 €/g</span></div>
            </div>

            {level3State === 'b2' && (
              <div className="l3-panel">
                <p><strong>Metallverbrauch:</strong> Goldverbrauch diese Woche: 42g (-5g vs. Vorwoche).</p>
                <p style={{marginTop:4}}>Kupfer-EK bei 8.78 €/kg (Markt fällt leicht).</p>
              </div>
            )}
          </div>
        </div>
      </DetailOverlay>

      {/* Kunden & Markt Overlay */}
      <DetailOverlay open={activeOverlay === 'kunden'} onClose={() => setActiveOverlay(null)} title="Kunden & Markt">
        <div style={{color: 'var(--ink)'}}>
          <div className="l2-box" onClick={() => setLevel3State(level3State === 'k1' ? null : 'k1')}>
            <div className="l2-title"><HeartHandshake className="w-4 h-4" /> Top-Kunden & CLV</div>
            <div className="l2-desc">CLV-Fokus auf Museum Lenzburg (18.400 €).</div>
            {level3State === 'k1' && (
              <div className="l3-panel">
                <p><strong>Top 3:</strong> 1. Lenzburg, 2. Autohaus Berger, 3. Schlosserei Brunner.</p>
                <p style={{marginTop:4}}><strong>Kundenrisiko:</strong> 1 Großkunde droht abzuwandern (Lieferverzug).</p>
                <div style={{marginTop: 12, display:'flex', gap:8, flexWrap:'wrap'}}>
                  <Link href="/customers" className="cmp-btn">Kundenkartei</Link>
                  <Link href="/kommunikation" className="cmp-btn">Kommunikation</Link>
                </div>
              </div>
            )}
          </div>

          <div className="l2-box" onClick={() => setLevel3State(level3State === 'k2' ? null : 'k2')}>
            <div className="l2-title"><Map className="w-4 h-4" /> Regionen, Versand & Zahlungsmoral</div>
            <div className="l2-desc">82% pünktliche Zahlung. 82% Abholung / 18% Versand.</div>
            
            <div style={{marginTop:12, display:'flex', gap:10}}>
              <div style={{flex:1, height:4, background:'var(--pos)', borderRadius:2}} title="Abholung 82%"></div>
              <div style={{width:'18%', height:4, background:'var(--info)', borderRadius:2}} title="Versand 18%"></div>
            </div>

            {level3State === 'k2' && (
              <div className="l3-panel">
                <p><strong>Regionen:</strong> DACH (95%), Rest-EU (5%).</p>
                <p style={{marginTop:4}}><strong>Zahlungsmoral:</strong> Ø 18 Tage (Vorjahr: 22 Tage). Tendenz: Sehr gut.</p>
                <div style={{marginTop: 12, display:'flex', gap:8}}>
                  <Link href="/finanzen" className="cmp-btn">Finanzen / Mahnwesen</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </DetailOverlay>

    </div>
  );
}
