"use client";

import React, { useState, useEffect } from 'react';
import 'next/link';
import 'lucide-react';

interface PerformanceDetailLayoutProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  pill?: { label: string; variant: 'green' | 'yellow' | 'purple' };
  children: React.ReactNode;
}

export function PerformanceDetailLayout({
  title,
  subtitle,
  icon,
  accentColor,
  pill,
  children,
}: PerformanceDetailLayoutProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('perfTheme');
    if (saved === 'dark' || saved === 'light') setTimeout(() => setTheme(saved), 0);
  }, []);

  const pillClass =
    pill?.variant === 'green'
      ? 'pd-pill-g'
      : pill?.variant === 'yellow'
        ? 'pd-pill-y'
        : 'pd-pill-p';

  return (
    <div className={`pd-wrapper ${theme === 'light' ? 'light' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .pd-wrapper {
          --bg: #0E1626; --sf: #1A2436; --sf2: #222E42; --sf3: #2A3650;
          --ink: #EEF2F8; --ink2: #9FB0C7; --ink3: #6B7A91;
          --bd: rgba(255,255,255,0.09); --bd2: rgba(255,255,255,0.14);
          --pos: #34D399; --neg: #F87171; --warn: #FBBF24; --info: #60A5FA;
          --cyan: #22D3EE; --purple: #A78BFA;
          --posbg: rgba(52,211,153,0.12); --negbg: rgba(248,113,113,0.12);
          --warnbg: rgba(251,191,36,0.12); --infobg: rgba(96,165,250,0.12);
          --purpbg: rgba(167,139,250,0.1); --glass: rgba(255,255,255,0.04);
          --font: 'DM Sans', system-ui, sans-serif;
          background: var(--bg); color: var(--ink); font-family: var(--font);
          transition: background 0.4s, color 0.4s;
          min-height: 100vh; padding: 16px; border-radius: 20px;
        }
        .pd-wrapper.light {
          --bg: #EDEBE4; --sf: #FFFFFF; --sf2: #F4F1EB; --sf3: #EBE8E0;
          --ink: #1A2847; --ink2: #4B5563; --ink3: #6E7A8A;
          --bd: rgba(26,40,71,0.1); --bd2: rgba(26,40,71,0.16);
          --pos: #059669; --neg: #DC2626; --warn: #B45309; --info: #2563EB;
          --cyan: #0E7490; --purple: #6D28D9;
          --posbg: rgba(5,150,105,0.1); --negbg: rgba(220,38,38,0.08);
          --warnbg: rgba(180,83,9,0.09); --infobg: rgba(37,99,235,0.08);
          --purpbg: rgba(109,40,217,0.08); --glass: rgba(255,255,255,0.55);
        }
        .pd-inner { max-width: 1400px; margin: 0 auto; width: 100%; }
        .pd-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink2); text-decoration: none; margin-bottom: 20px; padding: 8px 14px; border-radius: 10px; border: 1px solid var(--bd); background: var(--sf); transition: all 0.2s; }
        .pd-back:hover { color: var(--ink); border-color: var(--bd2); background: var(--sf2); }
        .pd-hero { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
        .pd-ico { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pd-title { font-size: 28px; font-weight: 700; line-height: 1.15; letter-spacing: -0.5px; }
        .pd-sub { font-size: 13px; color: var(--ink2); margin-bottom: 28px; font-weight: 500; line-height: 1.5; }
        .pd-pill { font-size: 10px; font-weight: 700; padding: 4px 12px; border-radius: 8px; white-space: nowrap; letter-spacing: 0.4px; text-transform: uppercase; }
        .pd-pill-g { background: var(--posbg); color: var(--pos); }
        .pd-pill-y { background: var(--warnbg); color: var(--warn); }
        .pd-pill-p { background: var(--purpbg); color: var(--purple); }
        .pd-grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
        @media(min-width:768px) { .pd-grid { grid-template-columns: repeat(2, 1fr); } }
        @media(min-width:1200px) { .pd-grid { grid-template-columns: repeat(3, 1fr); } }
        .pd-tile { background: var(--sf); border: 0.5px solid var(--bd); border-radius: 16px; padding: 20px; position: relative; overflow: hidden; transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s, border-color 0.3s; }
        .pd-tile:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.18); border-color: var(--bd2); }
        .pd-wrapper.light .pd-tile:hover { box-shadow: 0 12px 30px rgba(0,0,0,0.07); }
        .pd-tile-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .pd-tile-ico { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pd-tile-name { font-size: 15px; font-weight: 700; line-height: 1.2; }
        .pd-tile-val { font-size: 22px; font-weight: 700; margin: 8px 0 4px; line-height: 1; }
        .pd-tile-desc { font-size: 11px; color: var(--ink2); line-height: 1.4; font-weight: 500; }
        .pd-tile-foot { margin-top: 14px; display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: var(--ink3); text-transform: uppercase; letter-spacing: 0.4px; transition: color 0.2s; }
        .pd-tile:hover .pd-tile-foot { color: var(--ink); }
        .pd-link { text-decoration: none; color: inherit; display: block; cursor: pointer; }
        .pd-bar-row { display: flex; align-items: center; gap: 8px; font-size: 11px; margin-bottom: 6px; }
        .pd-bar-label { width: 72px; flex-shrink: 0; font-weight: 500; color: var(--ink2); }
        .pd-bar-track { flex: 1; height: 8px; background: var(--bd); border-radius: 4px; overflow: hidden; }
        .pd-bar-fill { height: 100%; border-radius: 4px; transition: width 1s ease; }
        .pd-bar-val { width: 40px; text-align: right; font-weight: 600; flex-shrink: 0; }
        .pd-stack { display: flex; height: 22px; border-radius: 6px; overflow: hidden; border: 1px solid var(--bd); }
        .pd-stack-seg { display: flex; align-items: center; padding: 0 6px; font-size: 9px; font-weight: 600; color: #fff; white-space: nowrap; }
        .pd-mini-bars { display: flex; align-items: flex-end; gap: 3px; height: 36px; margin: 10px 0 4px; }
        .pd-mini-bar { flex: 1; border-radius: 3px 3px 0 0; transition: height 1s ease; }
        .pd-mini-bar-labels { display: flex; gap: 3px; }
        .pd-mini-bar-labels span { flex: 1; font-size: 8px; color: var(--ink3); text-align: center; font-weight: 500; }
        .pd-heatmap { display: flex; gap: 3px; }
        .pd-heatmap-cell { flex: 1; height: 14px; border-radius: 3px; }
        .pd-sparkline { margin: 8px 0 2px; }
        .pd-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink3); margin-bottom: 16px; margin-top: 8px; }
        .pd-wide { grid-column: 1 / -1; }
        .pd-divider { grid-column: 1 / -1; border: none; border-top: 1px solid var(--bd); margin: 8px 0; }
        .pd-module-links { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; grid-column: 1 / -1; }
        .pd-module-link { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border: 1px solid var(--bd); border-radius: 10px; background: var(--sf); color: var(--ink2); font-size: 12px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
        .pd-module-link:hover { border-color: var(--info); color: var(--ink); background: var(--sf2); }
        @keyframes pdFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .pd-grid > * { animation: pdFadeIn 0.4s ease both; }
        .pd-grid > *:nth-child(2) { animation-delay: 0.05s; }
        .pd-grid > *:nth-child(3) { animation-delay: 0.1s; }
        .pd-grid > *:nth-child(4) { animation-delay: 0.15s; }
        .pd-grid > *:nth-child(5) { animation-delay: 0.2s; }
        .pd-grid > *:nth-child(6) { animation-delay: 0.25s; }
        .pd-grid > *:nth-child(7) { animation-delay: 0.3s; }
        .pd-grid > *:nth-child(8) { animation-delay: 0.35s; }
      `}} />
      <div className="pd-inner">


        <div className="pd-hero">
          <div className="pd-ico" style={{ background: accentColor }}>
            {icon}
          </div>
          <div className="pd-title">{title}</div>
          {pill && <span className={`pd-pill ${pillClass}`}>{pill.label}</span>}
        </div>
        <div className="pd-sub">{subtitle}</div>

        {children}
      </div>
    </div>
  );
}
