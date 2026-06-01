"use client";

import React, { useState, useEffect } from 'react';
import { 
  Moon, Sun, Clock, Coins, Activity, Target, Sparkles, 
  TrendingUp, AlertTriangle, FlaskConical, UserPlus, Download, 
  Lock, Unlock, Building, FileSpreadsheet, FileText, LineChart, 
  Receipt, PiggyBank, Camera, ChevronRight 
} from 'lucide-react';

export default function PerformanceCockpit() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [tab, setTab] = useState('Monat');
  const [yoy, setYoy] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [metalExpOpen, setMetalExpOpen] = useState(false);
  const [fkpOpen, setFkpOpen] = useState(false);

  const [rate, setRate] = useState(95);
  const [fix, setFix] = useState(2500);
  const [rateLocked, setRateLocked] = useState(true);
  const [fixLocked, setFixLocked] = useState(true);

  // Calculate live values
  const rev = Math.round(rate * 446.105);
  const db = Math.round(rev * 0.279);
  const profit = db - fix;

  // Persist theme locally
  useEffect(() => {
    const saved = localStorage.getItem('performanceTheme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
    }
  }, []);

  const toggleTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    localStorage.setItem('performanceTheme', t);
  };

  const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });

  return (
    <div className={`ck ${theme === 'dark' ? 'dark' : ''} max-w-6xl mx-auto`} id="ck">
      <style dangerouslySetInnerHTML={{__html: `
        .ck { --bg:#F0EBE0; --surf:#fff; --surf2:#F9F6F1; --navy:#1A2847; --ink:#1A2847; --ink2:#5B6472; --ink3:#9CA3AF; --bd:rgba(26,40,71,.09); --pos:#16A34A; --neg:#DC2626; --warn:#C2730A; --info:#2563EB; --cyan:#0E7490; --purple:#6D28D9; --glass:rgba(255,255,255,.55); --posbg:rgba(22,163,74,.1); --negbg:rgba(220,38,38,.09); --warnbg:rgba(194,115,10,.1); --infobg:rgba(37,99,235,.09); --purpbg:rgba(109,40,217,.08); font-family: var(--font-sans), sans-serif; background: var(--bg); border-radius: 16px; padding: 16px; color: var(--ink); transition: background .3s; }
        .ck.dark { --bg:#0E1626; --surf:#1A2436; --surf2:#222E42; --navy:#222E42; --ink:#EEF2F8; --ink2:#9FB0C7; --ink3:#6B7A91; --bd:rgba(255,255,255,.09); --pos:#34D399; --neg:#F87171; --warn:#FBBF24; --info:#60A5FA; --cyan:#22D3EE; --purple:#A78BFA; --glass:rgba(255,255,255,.05); --posbg:rgba(52,211,153,.12); --negbg:rgba(248,113,113,.12); --warnbg:rgba(251,191,36,.12); --infobg:rgba(96,165,250,.12); --purpbg:rgba(167,139,250,.12); }
        .ck .bar { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 0 12px; flex-wrap:wrap; }
        .ck .tabs { display:flex; gap:2px; background:var(--surf2); border-radius:9px; padding:3px; }
        .ck .tab { font-size:12px; padding:6px 12px; border-radius:7px; color:var(--ink2); cursor:pointer; transition:all .15s; border:none; background:none; font-family:inherit; }
        .ck .tab.on { background:var(--surf); color:var(--ink); font-weight:600; box-shadow:0 1px 3px rgba(0,0,0,.08); }
        .ck.dark .tab.on { background:#324056; }
        .ck .toolr { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .ck .themesw { display:flex; background:var(--surf2); border-radius:8px; padding:3px; gap:2px; }
        .ck .tsw { font-size:12px; padding:6px 10px; border-radius:6px; border:none; background:none; color:var(--ink2); cursor:pointer; display:flex; align-items:center; gap:6px; font-family:inherit; }
        .ck .tsw.on { background:var(--navy); color:#fff; font-weight:600; }
        .ck.dark .tsw.on { background:#3B4A63; color:#fff; }
        .ck .ytog { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink2); cursor:pointer; user-select:none; }
        .ck .tp { width:32px; height:18px; background:var(--bd); border-radius:9px; position:relative; transition:.2s; flex-shrink:0; }
        .ck .tp.on { background:var(--pos); }
        .ck .tpd { width:14px; height:14px; background:#fff; border-radius:50%; position:absolute; top:2px; left:2px; transition:.2s; }
        .ck .tp.on .tpd { transform:translateX(14px); }
        .ck .tt { margin:0 0 16px; }
        .ck .tt h1 { font-size:22px; font-weight:700; margin:0; }
        .ck .tt .sub { font-size:13px; color:var(--ink2); margin-top:3px; }
        .ck .tt .meta { font-size:12px; color:var(--ink3); }
        .ck .glass { background:var(--glass); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); border:0.5px solid var(--bd); border-radius:13px; padding:14px 16px; margin:0 0 16px; display:flex; align-items:flex-start; gap:12px; cursor:pointer; transition:box-shadow .25s; }
        .ck .glass:hover { box-shadow:0 6px 24px rgba(0,0,0,.1); }
        .ck .gtag { background:var(--purple); color:#fff; font-size:10px; font-weight:600; padding:4px 8px; border-radius:6px; white-space:nowrap; flex-shrink:0; margin-top:2px; letter-spacing:.4px; }
        .ck.dark .gtag { color:#0E1626; }
        .ck .sec { font-size:12px; font-weight:600; color:var(--ink3); text-transform:uppercase; letter-spacing:.8px; margin:20px 0 12px; display:flex; align-items:center; gap:8px; }
        .ck .topgrid { display:grid; grid-template-columns:auto 1fr; gap:12px; margin:0 0 10px; align-items:stretch; }
        @media (max-width: 800px) { .ck .topgrid { grid-template-columns:1fr; } }
        .ck .scbox { background:var(--navy); border-radius:14px; padding:18px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-width:140px; }
        .ck .scl { font-size:10px; font-weight:600; color:rgba(255,255,255,.5); text-transform:uppercase; letter-spacing:.5px; }
        .ck .rw { position:relative; width:90px; height:90px; }
        .ck .rp { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:24px; font-weight:600; color:#fff; }
        .ck .crit { background:rgba(248,113,113,.18); color:#FCA5A5; font-size:10px; font-weight:600; padding:4px 10px; border-radius:9px; text-align:center; }
        .ck .detb { font-size:12px; color:rgba(255,255,255,.4); cursor:pointer; margin-top:4px; }
        .ck .detb:hover { color:rgba(255,255,255,.8); }
        .ck .k4 { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; }
        .ck .card { background:var(--surf); border-radius:13px; padding:16px; cursor:pointer; transition:transform .22s,box-shadow .22s; border:0.5px solid var(--bd); position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:center; }
        .ck .card:hover { transform:translateY(-3px); box-shadow:0 10px 26px rgba(0,0,0,.12); }
        .ck .cl { font-size:12px; font-weight:600; color:var(--ink3); margin:0 0 6px; }
        .ck .cv { font-size:24px; font-weight:700; line-height:1.15; }
        .ck .csub { font-size:13px; color:var(--ink2); margin:4px 0 0; }
        .ck .pos { color:var(--pos); } .ck .neg { color:var(--neg); } .ck .warn { color:var(--warn); } .ck .info { color:var(--info); } .ck .cy { color:var(--cyan); } .ck .pu { color:var(--purple); }
        .ck .accL { border-left:4px solid; }
        .ck .hero { background:linear-gradient(135deg,var(--navy),var(--navy)); border:0.5px solid var(--bd); position:relative; }
        .ck .heroglow { position:absolute; inset:0; background:radial-gradient(circle at 80% 20%,rgba(251,191,36,.18),transparent 60%); pointer-events:none; }
        .ck .stst { display:grid; grid-template-columns:1fr; gap:10px; }
        .ck .strow { background:var(--surf); border:0.5px solid var(--bd); border-radius:11px; padding:14px 16px; cursor:pointer; transition:transform .2s,box-shadow .2s; display:grid; grid-template-columns:110px 1fr 50px; align-items:center; gap:14px; }
        .ck .strow:hover { transform:translateX(2px); box-shadow:0 4px 14px rgba(0,0,0,.08); }
        .ck .stn { font-size:14px; font-weight:600; }
        .ck .stbar { height:8px; background:var(--bd); border-radius:4px; overflow:hidden; }
        .ck .stf { height:100%; border-radius:4px; transition:width 1.1s cubic-bezier(.4,0,.2,1); }
        .ck .stpct { font-size:14px; font-weight:600; text-align:right; }
        .ck .chartcard { background:var(--surf); border:0.5px solid var(--bd); border-radius:13px; padding:18px; margin:0 0 14px; }
        .ck .chl { display:flex; align-items:center; justify-content:space-between; margin:0 0 14px; }
        .ck .cht { font-size:15px; font-weight:600; }
        .ck .chbadge { font-size:10px; font-weight:600; background:var(--infobg); color:var(--info); padding:3px 8px; border-radius:10px; }
        .ck .leg { display:flex; gap:16px; font-size:12px; color:var(--ink2); margin:12px 0 0; flex-wrap:wrap; }
        .ck .leg span { display:flex; align-items:center; gap:6px; }
        .ck .dot { width:12px; height:4px; border-radius:2px; }
        .ck .alert { border-left:3px solid var(--neg); background:var(--negbg); border-radius:0 10px 10px 0; padding:12px 16px; margin:14px 0 0; font-size:13px; color:var(--ink); line-height:1.5; }
        .ck .metal { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; }
        .ck .mcard { background:var(--surf); border:0.5px solid var(--bd); border-radius:12px; padding:16px; cursor:pointer; transition:transform .2s,box-shadow .2s; }
        .ck .mcard:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,.1); }
        .ck .mhead { display:flex; align-items:center; justify-content:space-between; margin:0 0 10px; }
        .ck .mname { font-size:15px; font-weight:600; display:flex; align-items:center; gap:8px; }
        .ck .mdot { width:12px; height:12px; border-radius:50%; }
        .ck .mmarge { font-size:20px; font-weight:600; }
        .ck .mrow { display:flex; justify-content:space-between; font-size:13px; margin:5px 0; color:var(--ink2); }
        .ck .mrow b { color:var(--ink); font-weight:600; }
        .ck .col2 { display:grid; grid-template-columns:1fr; gap:12px; }
        @media (min-width: 800px) { .ck .col2 { grid-template-columns:1fr 1fr; } }
        .ck .panel { background:var(--surf); border:0.5px solid var(--bd); border-radius:13px; padding:18px; }
        .ck .pt { font-size:15px; font-weight:600; margin:0 0 12px; }
        .ck .rk { margin:10px 0; }
        .ck .rkrow { display:flex; justify-content:space-between; font-size:13px; margin:0 0 5px; }
        .ck .rkbar { height:6px; background:var(--bd); border-radius:3px; overflow:hidden; }
        .ck .rkf { height:100%; border-radius:3px; }
        .ck .cust { display:flex; justify-content:space-between; align-items:flex-start; padding:10px 0; border-bottom:0.5px solid var(--bd); }
        .ck .cust:last-child { border:none; }
        .ck .custn { font-size:14px; font-weight:600; }
        .ck .custm { font-size:12px; color:var(--ink3); margin-top:2px; }
        .ck .custv { font-size:15px; font-weight:600; text-align:right; white-space:nowrap; }
        .ck .newt { font-size:10px; background:var(--warnbg); color:var(--warn); padding:3px 6px; border-radius:8px; margin-left:6px; vertical-align:middle; }
        .ck .week { background:var(--surf); border:0.5px solid var(--bd); border-radius:13px; padding:18px; }
        .ck .prog { height:12px; background:var(--bd); border-radius:6px; overflow:hidden; margin:10px 0; }
        .ck .progf { height:100%; background:var(--pos); border-radius:6px; transition:width 1.1s cubic-bezier(.4,0,.2,1); }
        .ck .streak { display:flex; align-items:center; gap:10px; margin:14px 0 0; }
        .ck .stkb { background:var(--warnbg); color:var(--warn); font-weight:600; font-size:13px; padding:5px 12px; border-radius:12px; display:inline-flex; align-items:center; gap:6px; }
        .ck .wow { background:var(--surf); border:0.5px solid var(--bd); border-radius:13px; padding:18px; margin:0 0 14px; }
        .ck .wowh { font-size:16px; font-weight:600; margin:0 0 14px; display:flex; align-items:center; gap:8px; }
        .ck .wowb { font-size:10px; font-weight:600; background:var(--purpbg); color:var(--purple); padding:3px 8px; border-radius:9px; letter-spacing:.5px; }
        .ck .warn-card { border-radius:10px; padding:14px 16px; margin:0 0 8px; font-size:14px; line-height:1.55; }
        .ck .wc-i { background:var(--infobg); } .ck .wc-r { background:var(--negbg); } .ck .wc-a { background:var(--warnbg); } .ck .wc-g { background:var(--posbg); }
        .ck .wch { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; margin:0 0 6px; display:flex; align-items:center; gap:6px; }
        .ck .sim { background:var(--navy); border-radius:13px; padding:18px; margin:0 0 14px; }
        .ck .simh { font-size:16px; font-weight:600; color:#fff; margin:0 0 18px; display:flex; align-items:center; justify-content:space-between; }
        .ck .eb { background:rgba(255,255,255,.09); border:0.5px solid rgba(255,255,255,.15); border-radius:8px; padding:6px 14px; font-size:13px; color:rgba(255,255,255,.65); font-family:inherit; opacity:0.6; cursor:not-allowed; }
        .ck .slbl { font-size:13px; color:rgba(255,255,255,.5); display:flex; align-items:center; justify-content:space-between; margin:0 0 8px; }
        .ck .sval { font-size:15px; font-weight:600; color:#fff; min-width:70px; text-align:right; }
        .ck .lbtn { background:none; border:0.5px solid rgba(255,255,255,.15); border-radius:6px; padding:4px 12px; font-size:12px; color:rgba(255,255,255,.45); cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-family:inherit; }
        .ck .lbtn:hover { background:rgba(255,255,255,.08); color:rgba(255,255,255,.75); }
        .ck .lbtn.op { background:rgba(248,113,113,.16); border-color:rgba(248,113,113,.4); color:#FCA5A5; }
        .ck .slk input[type=range] { pointer-events:none; opacity:.4; }
        .ck .s3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:16px 0 0; }
        .ck .s3c { background:rgba(255,255,255,.07); border-radius:10px; padding:14px 16px; }
        .ck .s3l { font-size:11px; font-weight:600; color:rgba(255,255,255,.4); text-transform:uppercase; letter-spacing:.5px; margin:0 0 6px; }
        .ck .s3v { font-size:20px; font-weight:600; color:#fff; }
        .ck .fcb { background:rgba(255,255,255,.06); border-radius:10px; padding:14px 18px; margin:12px 0 0; display:flex; align-items:center; justify-content:space-between; }
        .ck .tax { background:var(--surf); border:0.5px solid var(--bd); border-radius:13px; padding:18px; margin:0 0 14px; }
        .ck .tg { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin:14px 0; }
        .ck .tb { display:flex; align-items:center; gap:14px; padding:14px 16px; border:0.5px solid var(--bd); border-radius:10px; font-size:14px; font-weight:600; opacity:0.6; }
        .ck .tb .ts { font-size:12px; color:var(--ink3); font-weight:400; margin-top:3px; }
        .ck .saveb { background:var(--posbg); border:0.5px solid var(--pos); border-radius:10px; padding:14px 18px; margin:12px 0 0; font-size:13px; color:var(--ink); display:flex; align-items:center; gap:12px; }
        .ck .aibox { background:var(--purpbg); border:0.5px solid var(--bd); border-radius:10px; padding:16px; margin:12px 0 0; font-size:14px; line-height:1.55; }
        .ck .aih { font-size:11px; font-weight:600; color:var(--purple); text-transform:uppercase; letter-spacing:.5px; margin:0 0 8px; display:flex; align-items:center; gap:6px; }
        .ck .mkt { background:var(--surf); border:0.5px solid var(--bd); border-radius:13px; padding:18px; display:flex; align-items:center; gap:16px; }
        .ck .mktic { width:48px; height:48px; border-radius:12px; background:var(--purpbg); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--purple); }
        .ck .fkp { background:var(--surf2); border-radius:11px; padding:16px 18px; margin:10px 0 14px; border:0.5px solid var(--bd); }
        .ck .fkr { display:grid; grid-template-columns:1fr 100px 20px; gap:8px; align-items:center; font-size:14px; padding:6px 0; }
        .ck .detexp { background:var(--surf2); border-radius:10px; padding:14px 16px; margin:12px 0 0; font-size:13px; }
        .ck input[type=number] { border:0.5px solid var(--bd); border-radius:6px; padding:8px 10px; font-size:14px; text-align:right; background:var(--surf); color:var(--ink); font-family:inherit; }
        .ck input[type=range] { width:100%; accent-color:#A78BFA; }
        .ck #rate { accent-color:#22D3EE; }
      `}} />

      {/* 1. Toolbar */}
      <div className="bar">
        <div className="tabs">
          {['Woche', 'Monat', 'Quartal', 'Jahr', 'Frei'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        <div className="toolr">
          <div className="ytog" onClick={() => setYoy(!yoy)}>
            <div className={`tp ${yoy ? 'on' : ''}`}><div className="tpd"></div></div>Vorjahr
          </div>
          <div className="themesw">
            <button className={`tsw ${theme === 'dark' ? 'on' : ''}`} onClick={() => toggleTheme('dark')}><Moon size={15} />Dark</button>
            <button className={`tsw ${theme === 'light' ? 'on' : ''}`} onClick={() => toggleTheme('light')}><Sun size={15} />Hell</button>
          </div>
        </div>
      </div>

      {/* 2. Header */}
      <div className="tt">
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', flexWrap:'wrap', gap:'8px'}}>
          <div><h1>Mai 2026 — Auswertung</h1><div className="sub">Vergleich zu Mai 2025 · Day-by-Day · Stand 09:14</div></div>
          <div className="meta">22 Werktage · 5 MA · 5 Stationen</div>
        </div>
      </div>

      {/* 3. KI Analyse */}
      <div className="glass">
        <span className="gtag">KI-ANALYSE</span>
        <div style={{flex:1, fontSize:'14px', color:'var(--ink)', lineHeight:1.55}}>
          <span style={{fontWeight:600}}>Lage Mai:</span> Umsatz +7,2% über Vorjahr, aber Termintreue auf 76% gefallen (−9 %-P) — Ursache: Schleiferei seit 3 Wochen Engpass. Deckungsbeitrag stabil. <span className="warn">Goldpreis +14% seit Badkauf → Metall-Marge auf Rekordniveau. Energiepreis Q2 +8% noch nicht eingepreist.</span>
        </div>
        <div style={{fontSize:'13px', color:'var(--ink3)', cursor:'pointer', whiteSpace:'nowrap'}}>Details ›</div>
      </div>

      <div className="sec"><Clock size={16} /> Durchsatz &amp; Geld</div>

      {/* 4. Hotzone KPI */}
      <div className="topgrid">
        <div className="scbox">
          <div className="scl">Gesamtbewertung</div>
          <div className="rw">
            <svg width="90" height="90" viewBox="0 0 78 78" style={{transform:'rotate(-90deg)'}} aria-hidden="true">
              <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#A78BFA"/></linearGradient></defs>
              <circle cx="39" cy="39" r="31" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="7"/>
              <circle cx="39" cy="39" r="31" fill="none" stroke="url(#rg)" strokeWidth="7" strokeLinecap="round" strokeDasharray="195" strokeDashoffset={195 * (1 - 0.64)}/>
            </svg>
            <div className="rp">64%</div>
          </div>
          <div className="crit">Handlungsbedarf</div>
          <div className="detb" onClick={() => setDetailOpen(!detailOpen)}>Details ↓</div>
        </div>
        
        <div className="k4">
          <div className="card accL" style={{borderLeftColor:'var(--neg)'}}>
            <div className="cl">Termintreue?</div><div className="cv neg">76 %</div>
            <div className="csub neg">▼ −9 %-P vs. Vj. (85%)</div>
            <svg viewBox="0 0 60 14" width="60" height="14" style={{marginTop:'8px'}} aria-hidden="true"><polyline points="0,3 12,4 24,6 36,7 48,9 60,11" fill="none" stroke="var(--neg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="card accL" style={{borderLeftColor:'var(--warn)'}}>
            <div className="cl">Ø Durchlaufzeit?</div><div className="cv warn">9,4 Tage</div>
            <div className="csub warn">▼ +1,2 T vs. Vj. (8,2)</div>
            <svg viewBox="0 0 60 14" width="60" height="14" style={{marginTop:'8px'}} aria-hidden="true"><polyline points="0,9 12,8 24,9 36,7 48,6 60,4" fill="none" stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="card accL" style={{borderLeftColor:'var(--pos)'}}>
            <div className="cl">Umsatz netto?</div><div className="cv">42.380 €</div>
            <div className="csub pos">▲ +7,2% vs. Vj. (39.520 €)</div>
            <svg viewBox="0 0 60 14" width="60" height="14" style={{marginTop:'8px'}} aria-hidden="true"><polyline points="0,11 12,9 24,10 36,7 48,6 60,4" fill="none" stroke="var(--pos)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="card accL" style={{borderLeftColor:'var(--info)'}}>
            <div className="cl">Deckungsbeitrag?</div><div className="cv">11.840 €</div>
            <div className="csub">Marge 27,9% · DB II</div>
            <svg viewBox="0 0 60 14" width="60" height="14" style={{marginTop:'8px'}} aria-hidden="true"><polyline points="0,10 12,9 24,8 36,8 48,7 60,6" fill="none" stroke="var(--info)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </div>

      {detailOpen && (
        <div className="detexp" style={{display:'block'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:'8px', color:'var(--ink2)'}}>
            <span>Termintreue (25%)</span><b className="neg" style={{fontWeight:600}}>76% (+15 Pkt.)</b>
            <span>Durchlaufzeit-Index (20%)</span><b className="warn" style={{fontWeight:600}}>71% (+14 Pkt.)</b>
            <span>Kritische Aufträge (20%)</span><b className="neg" style={{fontWeight:600}}>40% (+8 Pkt.)</b>
            <span>Fehlerquote QS (15%)</span><b className="pos" style={{fontWeight:600}}>93% (+14 Pkt.)</b>
            <span>OCR &amp; Scan-Doku (10%)</span><b style={{fontWeight:600}}>92% (+9 Pkt.)</b>
            <span>Stationen-Health (10%)</span><b style={{fontWeight:600}}>78% (+8 Pkt.)</b>
          </div>
        </div>
      )}

      {/* 5. Metall-Marge */}
      <div className="sec"><Coins size={16} /> Metall-Marge (live) — Alleinstellung</div>
      <div className="card hero" style={{marginBottom:'12px'}} onClick={() => setMetalExpOpen(!metalExpOpen)}>
        <div className="heroglow"></div>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative'}}>
          <div>
            <div style={{fontSize:'12px', fontWeight:600, color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:'.5px'}}>Metall-Marge gesamt (Mai)</div>
            <div style={{fontSize:'34px', fontWeight:700, color:'#fff', marginTop:'4px'}}>+2.840 €</div>
            <div style={{fontSize:'13px', color:'rgba(255,255,255,.7)', marginTop:'4px'}}>Erlös zum Tagespreis − Einkaufsbasis der Bäder · <span style={{color:'#FBBF24'}}>Stand 09:14</span></div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'13px', color:'rgba(255,255,255,.6)'}}>Gold-Tagespreis</div>
            <div style={{fontSize:'20px', fontWeight:600, color:'#FBBF24'}}>68,40 €/g</div>
            <div style={{fontSize:'12px', color:'#34D399'}}>▲ +14% seit Badkauf</div>
          </div>
        </div>
      </div>
      
      <div className="metal">
        <div className="mcard">
          <div className="mhead"><div className="mname"><span className="mdot" style={{background:'#FBBF24'}}></span>Gold</div><div className="mmarge pos">+1.640 €</div></div>
          <div className="mrow"><span>Abgeschieden</span><b>18,2 g</b></div>
          <div className="mrow"><span>Einkaufsbasis</span><b>22,80 €/g</b></div>
          <div className="mrow"><span>Tagespreis</span><b>68,40 €/g</b></div>
          <div className="mrow"><span>Marge</span><b className="pos">+72%</b></div>
        </div>
        <div className="mcard">
          <div className="mhead"><div className="mname"><span className="mdot" style={{background:'#94A3B8'}}></span>Silber</div><div className="mmarge pos">+310 €</div></div>
          <div className="mrow"><span>Abgeschieden</span><b>142 g</b></div>
          <div className="mrow"><span>Einkaufsbasis</span><b>0,62 €/g</b></div>
          <div className="mrow"><span>Tagespreis</span><b>0,98 €/g</b></div>
          <div className="mrow"><span>Marge</span><b className="pos">+58%</b></div>
        </div>
        <div className="mcard">
          <div className="mhead"><div className="mname"><span className="mdot" style={{background:'#D97706'}}></span>Kupfer</div><div className="mmarge pos">+185 €</div></div>
          <div className="mrow"><span>Abgeschieden</span><b>2,1 kg</b></div>
          <div className="mrow"><span>Einkaufsbasis</span><b>7,90 €/kg</b></div>
          <div className="mrow"><span>Tagespreis</span><b>8,78 €/kg</b></div>
          <div className="mrow"><span>Marge</span><b className="pos">+11%</b></div>
        </div>
        <div className="mcard">
          <div className="mhead"><div className="mname"><span className="mdot" style={{background:'#86EFAC'}}></span>Nickel</div><div className="mmarge pos">+705 €</div></div>
          <div className="mrow"><span>Abgeschieden</span><b>4,6 kg</b></div>
          <div className="mrow"><span>Einkaufsbasis</span><b>14,20 €/kg</b></div>
          <div className="mrow"><span>Tagespreis</span><b>15,90 €/kg</b></div>
          <div className="mrow"><span>Marge</span><b className="pos">+12%</b></div>
        </div>
      </div>

      {metalExpOpen && (
        <div className="detexp" style={{display:'block'}}>
          <b style={{fontWeight:600, color:'var(--ink)'}}>Rechenweg pro Teil:</b> Fläche [cm²] × Schichtdicke [µm] × Dichte = abgeschiedene Masse. Marge = Masse × (Tagespreis − Einkaufsbasis des Bades) × Stromausbeute, abzgl. Drag-out-Verlust. Tagespreise live via Metals-API, 1×/Tag aktualisiert. <span className="pu">Tipp: Goldpreis-Hoch — Auftrag A-2026-0042 (Vergoldung) jetzt abrechnen, nicht aufschieben.</span>
        </div>
      )}

      {/* 6. Engpässe */}
      <div className="sec"><Activity size={16} /> Stationen-Auslastung — Engpässe</div>
      <div className="stst">
        <div className="strow"><div className="stn">Schleiferei</div><div className="stbar"><div className="stf" style={{width:'94%', background:'var(--neg)'}}></div></div><div className="stpct neg">94%</div></div>
        <div className="strow"><div className="stn">Politur</div><div className="stbar"><div className="stf" style={{width:'78%', background:'var(--warn)'}}></div></div><div className="stpct warn">78%</div></div>
        <div className="strow"><div className="stn">Galvanik</div><div className="stbar"><div className="stf" style={{width:'62%', background:'var(--pos)'}}></div></div><div className="stpct pos">62%</div></div>
        <div className="strow"><div className="stn">Vorbereitung</div><div className="stbar"><div className="stf" style={{width:'54%', background:'var(--pos)'}}></div></div><div className="stpct pos">54%</div></div>
        <div className="strow"><div className="stn">QK / Versand</div><div className="stbar"><div className="stf" style={{width:'41%', background:'var(--pos)'}}></div></div><div className="stpct pos">41%</div></div>
      </div>

      <div className="chartcard" style={{marginTop:'14px'}}>
        <div className="chl"><div className="cht">Umsatzverlauf 12 Monate</div><div className="chbadge">MIT FORECAST</div></div>
        {/* Simple mock chart using CSS */}
        <div style={{height:'140px', display:'flex', alignItems:'flex-end', gap:'6px', paddingBottom:'22px', borderBottom:'1px solid var(--bd)', position:'relative', marginTop:'16px'}}>
          {[36,35,32,39,42,45,28,30,33,42,41,42].map((v,i) => (
            <div key={i} style={{flex:1, height:`${v*2}%`, background:'#3B82F6', borderRadius:'3px 3px 0 0', opacity: i===11 ? 1 : 0.6}}></div>
          ))}
          {[38,41,37].map((v,i) => (
            <div key={`f-${i}`} style={{flex:1, height:`${v*2}%`, background:'#F59E0B', borderRadius:'3px 3px 0 0', opacity: 0.8, border:'1px dashed rgba(255,255,255,0.3)'}}></div>
          ))}
          <div style={{position:'absolute', bottom:'-22px', width:'100%', display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--ink3)'}}>
            <span>Jun</span><span>Mai</span><span>Aug*</span>
          </div>
        </div>
        <div className="leg"><span><span className="dot" style={{background:'#3B82F6'}}></span>Ist</span><span><span className="dot" style={{background:'#94A3B8'}}></span>Vorjahr</span><span><span className="dot" style={{background:'#F59E0B'}}></span>Forecast 3 Monate</span></div>
        <div className="alert"><b style={{fontWeight:600}}>Engpass-Verlust:</b> Schleiferei seit 3 Wochen Hauptengpass. Geschätzter Umsatzverlust Mai: <b style={{fontWeight:600}}>4.300 €</b> (3 Aufträge ≥2 Tage verspätet, 1 Auftrag verloren). Maßnahme: Stoßstangen Mo–Mi priorisieren.</div>
      </div>

      <div className="col2">
        <div className="panel">
          <div className="pt">Reklamationen — Mai</div>
          <div style={{display:'flex', alignItems:'baseline', gap:'10px', margin:'0 0 12px'}}><span style={{fontSize:'32px', fontWeight:600}}>2</span><span style={{fontSize:'13px', color:'var(--ink2)'}}>von 28 · 7,1%</span><span style={{fontSize:'13px', marginLeft:'auto'}} className="neg">▲ +1 vs. Vj.</span></div>
          <div className="rk"><div className="rkrow"><span>Oberflächenqualität</span><span>1</span></div><div className="rkbar"><div className="rkf" style={{width:'50%', background:'var(--neg)'}}></div></div></div>
          <div className="rk"><div className="rkrow"><span>Lieferverzug</span><span>1</span></div><div className="rkbar"><div className="rkf" style={{width:'50%', background:'var(--warn)'}}></div></div></div>
          <div className="rk"><div className="rkrow"><span>Kommunikation</span><span>0</span></div><div className="rkbar"><div className="rkf" style={{width:'0', background:'var(--ink3)'}}></div></div></div>
          <div className="rk"><div className="rkrow"><span>Transport</span><span>0</span></div><div className="rkbar"><div className="rkf" style={{width:'0', background:'var(--ink3)'}}></div></div></div>
        </div>
        <div className="panel">
          <div className="pt">Top-Kunden — Mai <span className="chbadge" style={{background:'var(--purpbg)', color:'var(--purple)', marginLeft:'8px'}}>CLV-BASIERT</span></div>
          <div className="cust"><div><div className="custn">Museum Lenzburg</div><div className="custm">3 Aufträge · Stammkunde · CLV 18.400 €</div></div><div className="custv">5.840 €</div></div>
          <div className="cust"><div><div className="custn">Oldtimer Klassik Frankfurt</div><div className="custm">2 Aufträge · Privatsammler · CLV 12.200 €</div></div><div className="custv">3.920 €</div></div>
          <div className="cust"><div><div className="custn">Schreinerei Hartmann</div><div className="custm">4 Aufträge · Gewerbe · CLV 9.800 €</div></div><div className="custv">2.610 €</div></div>
          <div className="cust"><div><div className="custn">P. Steinmüller<span className="newt">NEU</span></div><div className="custm">1 Auftrag · Erstkunde</div></div><div className="custv">1.840 €</div></div>
        </div>
      </div>

      {/* 7. Wochenziel */}
      <div className="sec"><Target size={16} /> Wochenziel &amp; Trend</div>
      <div className="col2">
        <div className="week">
          <div style={{display:'flex', justifyContent:'space-between', fontSize:'14px'}}><span>Fertiggestellte Objekte</span><b style={{fontWeight:600}}>23 / 25</b></div>
          <div className="prog"><div className="progf" style={{width:'92%'}}></div></div>
          <div style={{fontSize:'13px', color:'var(--ink2)'}}>Noch 2 Aufträge bis zum Wochenziel</div>
          <div className="streak"><span className="stkb"><Target size={15} />5 Wochen</span><span style={{fontSize:'13px', color:'var(--ink2)'}}>Erfolgsserie über Ziel</span></div>
        </div>
        <div className="chartcard" style={{margin:0}}>
          <div className="cht" style={{margin:'0 0 12px'}}>Ø Bearbeitungszeit je Teiletyp</div>
          <div style={{display:'flex', alignItems:'flex-end', height:'100px', gap:'14px', paddingBottom:'12px', borderBottom:'1px solid var(--bd)'}}>
            <div style={{flex:1, background:'#F05252', height:'94%', borderRadius:'4px 4px 0 0', position:'relative'}}><div style={{position:'absolute', bottom:'-24px', fontSize:'11px', width:'100%', textAlign:'center', color:'var(--ink3)'}}>Stoßst.</div></div>
            <div style={{flex:1, background:'#3B82F6', height:'50%', borderRadius:'4px 4px 0 0', position:'relative'}}><div style={{position:'absolute', bottom:'-24px', fontSize:'11px', width:'100%', textAlign:'center', color:'var(--ink3)'}}>Motorr.</div></div>
            <div style={{flex:1, background:'#22C55E', height:'26%', borderRadius:'4px 4px 0 0', position:'relative'}}><div style={{position:'absolute', bottom:'-24px', fontSize:'11px', width:'100%', textAlign:'center', color:'var(--ink3)'}}>Kleint.</div></div>
          </div>
        </div>
      </div>

      {/* 8. Frühwarnungen */}
      <div className="wow">
        <div className="wowh"><Sparkles size={20} /> Forecast &amp; Frühwarnungen <span className="wowb">WOW</span></div>
        <div className="warn-card wc-i"><div className="wch info"><TrendingUp size={16} /> Umsatz-Prognose Jun–Aug</div>Erwartet: 38.200 € · 41.500 € · 36.800 € · Konfidenz 78%. Basis: 24-Monats-Saisonalität + Auftragsbestand. <span className="warn">Risiko: Juli −6% vs. Vj. — Oldtimer-Saison neigt sich, Reaktivierung jetzt einplanen.</span></div>
        <div className="warn-card wc-r"><div className="wch neg"><AlertTriangle size={16} /> Reklamations-Frühwarnung</div>Auftrag A-2026-0042 (Stoßstangen Opel Rekord) hat <b style={{fontWeight:600}}>84% Reklamationsrisiko</b>. 3 Mustertreffer: Schleiferei-Wartezeit 8 T, Privatkunde, Stoßstangen-Typ. Vorbeugung: Express-Schaltung + proaktive Kundenkommunikation heute.</div>
        <div className="warn-card wc-a"><div className="wch warn"><FlaskConical size={16} /> Bad-Frühwarnung</div><b style={{fontWeight:600}}>Nickelbad 1</b> schlägt voraussichtlich in <b style={{fontWeight:600}}>4 Tagen</b> Alarm (pH +0,12/Tag, Konzentration −2,1 g/l/Woche). Letzte stabile Messung 22.05. Dosierung Mittwoch früh einplanen — vermeidet ungeplanten Stopp Donnerstag.</div>
        <div className="warn-card wc-g"><div className="wch pos"><UserPlus size={16} /> Reaktivierung — überfällige Stammkunden</div><b style={{fontWeight:600}}>6 Stammkunden</b> über Bestellrhythmus hinaus. Potenzial: <b style={{fontWeight:600}}>11.200 €</b>. Top 3: Schmidt GmbH (7 Mt., Ø 5), Restauration Becker (9 Mt., Ø 6), Antikladen Wagner (8 Mt., Ø 6).</div>
      </div>

      {/* 9. Finanzcontrolling */}
      <div className="sim">
        <div className="simh"><span>Finanzcontrolling &amp; Kalkulation</span><button className="eb disabled opacity-50 cursor-not-allowed"><Download size={15} style={{display:'inline', marginRight:'6px'}}/>Lexware / DATEV (Geplant)</button></div>
        
        <div style={{margin:'0 0 16px'}}>
          <div className="slbl"><span>Verrechnungssatz (Netto)</span><div style={{display:'flex', alignItems:'center', gap:'10px'}}><span className="sval">{fmt(rate)} €/h</span><button className={`lbtn ${!rateLocked ? 'op' : ''}`} onClick={() => setRateLocked(!rateLocked)}>{rateLocked ? <Lock size={14}/> : <Unlock size={14}/>} {rateLocked ? 'gesichert' : 'entsperrt'}</button></div></div>
          <div className={rateLocked ? 'slk' : ''}><input type="range" min="50" max="200" value={rate} step="5" onChange={(e) => setRate(parseInt(e.target.value))} id="rate" /></div>
        </div>
        
        <div style={{margin:'0 0 16px'}}>
          <div className="slbl"><span>Monatliche Fixkosten <span onClick={() => setFkpOpen(!fkpOpen)} style={{color:'#FBBF24', cursor:'pointer', fontSize:'12px', marginLeft:'8px'}}>· bearbeiten</span></span><div style={{display:'flex', alignItems:'center', gap:'10px'}}><span className="sval">{fmt(fix)} €</span><button className={`lbtn ${!fixLocked ? 'op' : ''}`} onClick={() => setFixLocked(!fixLocked)}>{fixLocked ? <Lock size={14}/> : <Unlock size={14}/>} {fixLocked ? 'gesichert' : 'entsperrt'}</button></div></div>
          <div className={fixLocked ? 'slk' : ''}><input type="range" min="1000" max="10000" value={fix} step="100" onChange={(e) => setFix(parseInt(e.target.value))} id="fix" /></div>
        </div>

        {fkpOpen && (
          <div className="fkp">
            <div style={{fontSize:'14px', fontWeight:600, margin:'0 0 12px'}}>Fixkosten zusammenstellen</div>
            <div className="fkr"><span style={{color:'var(--ink2)'}}>Miete / Grundkosten</span><input type="number" defaultValue="1200" /><span style={{color:'var(--ink3)'}}>€</span></div>
            <div className="fkr"><span style={{color:'var(--ink2)'}}>Energie &amp; Strom</span><input type="number" defaultValue="650" /><span style={{color:'var(--ink3)'}}>€</span></div>
            <div className="fkr"><span style={{color:'var(--ink2)'}}>Versicherungen</span><input type="number" defaultValue="380" /><span style={{color:'var(--ink3)'}}>€</span></div>
            <div className="fkr"><span style={{color:'var(--ink2)'}}>Sonstiges</span><input type="number" defaultValue="270" /><span style={{color:'var(--ink3)'}}>€</span></div>
            <div style={{display:'flex', justifyContent:'flex-end', gap:'12px', marginTop:'16px'}}><button onClick={() => setFkpOpen(false)} className="tab" style={{border:'0.5px solid var(--bd)'}}>Abbrechen</button><button onClick={() => setFkpOpen(false)} style={{fontSize:'14px', padding:'10px 18px', border:'none', borderRadius:'8px', background:'var(--pos)', color:'#fff', cursor:'pointer', fontWeight:600}}>Speichern</button></div>
          </div>
        )}

        <div className="s3">
          <div className="s3c"><div className="s3l">Umsatz</div><div className="s3v">{fmt(rev)} €</div></div>
          <div className="s3c"><div className="s3l">Deckungsbeitrag</div><div className={`s3v ${db >= 0 ? 'pos' : 'neg'}`}>{fmt(db)} €</div></div>
          <div className="s3c"><div className="s3l">Gewinn</div><div className={`s3v ${profit >= 0 ? 'pos' : 'neg'}`}>{profit < 0 ? '-' : ''}{fmt(Math.abs(profit))} €</div></div>
        </div>
        
        <div className="fcb"><div><div style={{fontSize:'11px', fontWeight:600, color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:'.5px'}}>Umsatz-Forecast Monatsende</div><div style={{fontSize:'12px', color:'rgba(255,255,255,.5)', marginTop:'3px'}}>9 Aufträge im Fluss</div></div><div style={{fontSize:'26px', fontWeight:600, color:'#22D3EE'}}>{fmt(Math.round(rev * 1.06))} €</div></div>
      </div>

      {/* 10. DATEV Geplant */}
      <div className="tax">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 0 6px'}}><div style={{fontSize:'15px', fontWeight:600, display:'flex', alignItems:'center', gap:'8px'}}><Building size={18} />Finanzzentrale &amp; Buchhaltung</div><div style={{fontSize:'12px', color:'var(--ink3)'}}>Schritt zum Komplettsystem</div></div>
        <div style={{fontSize:'14px', color:'var(--ink2)', margin:'0 0 12px'}}>Direktexport für DATEV-Steuerberater, Behörden — oder Buchhaltung selbst übernehmen.</div>
        <div className="tg">
          <div className="tb"><FileSpreadsheet size={20} /><div>DATEV Buchungsstapel<div className="ts">EXTF-Format (Geplant)</div></div></div>
          <div className="tb"><FileText size={20} /><div>Lexware / Excel<div className="ts">Export (Geplant)</div></div></div>
          <div className="tb"><LineChart size={20} /><div>BWA (monatlich)<div className="ts">Betriebsauswertung (Geplant)</div></div></div>
          <div className="tb"><Receipt size={20} /><div>EÜR / UStVA<div className="ts">Jahres- &amp; Voranmeldung (Geplant)</div></div></div>
        </div>
        <div className="saveb opacity-60"><PiggyBank size={22} className="text-pos" /><div><b style={{fontWeight:600}}>Kostenersparnis:</b> Laufende Buchung + BWA selbst → ca. <b style={{fontWeight:600}}>50–70%</b> der Steuerberater-Kosten gespart. (Demnächst)</div></div>
        <div className="aibox"><div className="aih"><Sparkles size={16} /> KI-Steueranalyse</div>Deckungsbeitragsmarge 27,9% — bei eurem Energieaufwand solide. Verrechnungssatz 95→110 €/h ergäbe ceteris paribus <b style={{fontWeight:600}}>+8.400 € Jahresgewinn</b>. Energiekosten Q2 +8% noch nicht eingepreist. <span className="pu cursor-pointer">Vollanalyse + Prompt-Export (Geplant) ›</span></div>
      </div>

      {/* 11. Marketing Timing Geplant */}
      <div className="mkt opacity-80">
        <div className="mktic"><Camera size={24} /></div>
        <div style={{flex:1}}>
          <div style={{fontSize:'14px', fontWeight:600}}>Marketing-Timing <span className="chbadge" style={{background:'var(--purpbg)', color:'var(--purple)', marginLeft:'8px'}}>KI-TIPP (Geplant)</span></div>
          <div style={{fontSize:'13px', color:'var(--ink2)', marginTop:'5px'}}>Heute 18:30 ist euer bestes Story-Fenster (höchste Reichweite Di/Do). Vorschlag: vergoldeter Leuchter aus Auftrag #38 — vorher/nachher.</div>
        </div>
        <ChevronRight size={22} style={{color:'var(--ink3)'}} />
      </div>

    </div>
  );
}
