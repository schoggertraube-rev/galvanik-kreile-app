"use client";

// Prozessleiste exakt nach Bild 3: weiße Box-Icons, Pfeile in Kreile-Orange, dezenter beiger Hintergrund
export function WorkflowStrip() {
  return (
    <div className="w-full bg-gold-100 rounded-3xl mb-8 overflow-hidden relative border border-[#EDE8E1]">
      {/* Dekorative Punktegitter auf den Seiten (aus dem Referenzbild) */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-16 h-12 opacity-[0.07] pointer-events-none">
        <svg width="60" height="40" viewBox="0 0 60 40" fill="#001B38">
          <circle cx="10" cy="10" r="2" /><circle cx="20" cy="10" r="2" /><circle cx="30" cy="10" r="2" /><circle cx="40" cy="10" r="2" /><circle cx="50" cy="10" r="2" />
          <circle cx="10" cy="20" r="2" /><circle cx="20" cy="20" r="2" /><circle cx="30" cy="20" r="2" /><circle cx="40" cy="20" r="2" /><circle cx="50" cy="20" r="2" />
          <circle cx="10" cy="30" r="2" /><circle cx="20" cy="30" r="2" /><circle cx="30" cy="30" r="2" /><circle cx="40" cy="30" r="2" /><circle cx="50" cy="30" r="2" />
        </svg>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-12 opacity-[0.07] pointer-events-none">
        <svg width="60" height="40" viewBox="0 0 60 40" fill="#001B38">
          <circle cx="10" cy="10" r="2" /><circle cx="20" cy="10" r="2" /><circle cx="30" cy="10" r="2" /><circle cx="40" cy="10" r="2" /><circle cx="50" cy="10" r="2" />
          <circle cx="10" cy="20" r="2" /><circle cx="20" cy="20" r="2" /><circle cx="30" cy="20" r="2" /><circle cx="40" cy="20" r="2" /><circle cx="50" cy="20" r="2" />
          <circle cx="10" cy="30" r="2" /><circle cx="20" cy="30" r="2" /><circle cx="30" cy="30" r="2" /><circle cx="40" cy="30" r="2" /><circle cx="50" cy="30" r="2" />
        </svg>
      </div>

      <div className="relative flex items-center justify-between px-6 md:px-16 py-7">

        {/* Wareneingang */}
        <div className="flex flex-col items-center gap-2.5">
          <span className="text-xs font-black text-navy-900 uppercase tracking-wider">Wareneingang</span>
          <div className="w-[110px] h-[75px] bg-white rounded-2xl border border-neutral-gray-100 shadow-sm flex items-center justify-center transition-transform hover:scale-102">
            <svg viewBox="0 0 24 24" fill="none" stroke="#001B38" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
        </div>

        {/* Pfeil 1 */}
        <div className="flex-1 flex items-center justify-center px-4">
          <svg viewBox="0 0 100 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[120px] text-[#F28A0C]">
            <line x1="0" y1="6" x2="90" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <polyline points="84,1 94,6 84,11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Galvanik — mit rotem Blocker-Dot */}
        <div className="flex flex-col items-center gap-2.5">
          <span className="text-xs font-black text-navy-900 uppercase tracking-wider">Galvanik</span>
          <div className="relative w-[110px] h-[75px] bg-white rounded-2xl border border-neutral-gray-100 shadow-sm flex items-center justify-center transition-transform hover:scale-102">
            <svg viewBox="0 0 24 24" fill="none" stroke="#001B38" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9">
              <path d="M6 3h12" />
              <path d="M8 3v5c0 1.5-1 3-3 4.5S2 16 2 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2c0-2-1-3.5-3-5.5s-3-3-3-4.5V3" />
            </svg>
            {/* Roter Statuspunkt (Blocker/Problem) oben rechts auf der Kachel */}
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-danger-red rounded-full border-2 border-white shadow-sm" />
          </div>
        </div>

        {/* Pfeil 2 */}
        <div className="flex-1 flex items-center justify-center px-4">
          <svg viewBox="0 0 100 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[120px] text-[#F28A0C]">
            <line x1="0" y1="6" x2="90" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <polyline points="84,1 94,6 84,11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Warenausgang */}
        <div className="flex flex-col items-center gap-2.5">
          <span className="text-xs font-black text-navy-900 uppercase tracking-wider">Warenausgang</span>
          <div className="w-[110px] h-[75px] bg-white rounded-2xl border border-neutral-gray-100 shadow-sm flex items-center justify-center transition-transform hover:scale-102">
            <svg viewBox="0 0 24 24" fill="none" stroke="#001B38" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <rect x="2" y="3" width="14" height="13" rx="2" ry="2"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16"/>
              <circle cx="6.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
        </div>

      </div>
    </div>
  );
}
