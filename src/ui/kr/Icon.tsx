/** Icons aus den Seitenreferenzen (Büro · Werkstatt · Auftragskarte · Kundenkarte), Strich 2px */
const ICONS = {
  sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20a6 6 0 0 0-4-5.6"/>',
  euro:'<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5"/><path d="M5 10.5h8M5 13.5h8"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4 12H1M23 12h-3M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
  inbox:'<path d="M4 13l2.5 5h11L20 13"/><path d="M4 13V5h16v8"/><path d="M9 9l3 3 3-3"/>',
  truck:'<path d="M3 6.5h11v9H3z"/><path d="M14 9.5h4l3 3v3h-7z"/><circle cx="7.5" cy="17" r="1.7"/><circle cx="17.5" cy="17" r="1.7"/>',
  alert:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  camera:'<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.4"/>',
  card:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14.5h4"/>',
  check:'<path d="M5 12l4.5 4.5L19 7"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  box:'<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  handoff:'<circle cx="17" cy="7.5" r="3"/><path d="M12 20a5 5 0 0 1 10 0"/><path d="M2 12h7M6 9l3 3-3 3"/>',
  grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  user:'<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/>',
  back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  open:'<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  droplet:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  flag:'<path d="M6 21V4h12l-2.5 4L18 12H6"/>',
  phone:'<path d="M15.8 21A13.5 13.5 0 0 1 3 8.2 2.4 2.4 0 0 1 5.4 6h1.9L9 9.6 7 11a10 10 0 0 0 6 6l1.4-2 3.6 1.7v1.9A2.4 2.4 0 0 1 15.8 21z"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12.5h6M9 16h6"/>',
  receipt:'<path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21z"/><path d="M9.5 8.5h5M9.5 12.5h5"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  photo:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="M4 18l5-5 3.5 3L16 13l4 4"/>',
  photooff:'<path d="M3.5 4.2l16.3 16.3"/><path d="M5 6.5V19h13"/><circle cx="9" cy="10.2" r="1.4"/>',
  edit:'<path d="M5 19h4L20 8l-4-4L5 15z"/>',
  send:'<path d="M4.5 12l15.5-7.5-6 15-2.8-5.4z"/>',
  msg:'<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  checkc:'<circle cx="12" cy="12" r="9"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  scan:'<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  logout:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>'
} as const;
export type IconName = keyof typeof ICONS;
export interface IconProps { name: IconName; className?: string; }
export function Icon({ name, className }: IconProps) {
  // Pfaddaten sind konstante Quelltexte dieses Moduls, keine Nutzereingaben.
  return <svg className={className ? 'kr-i ' + className : 'kr-i'} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}
