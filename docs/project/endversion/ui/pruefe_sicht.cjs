#!/usr/bin/env node
// Prüft die gebaute App gegen ui/SICHTVERTRAG.json (Endversion = einzige UI-Wahrheit).
// Aufruf:  node pruefe_sicht.cjs --app https://…  --routen routen.json  [--nur eingang,auftrag] [--aus bericht.json]
// routen.json (füllt der Planungschat/Codex, inhaltsfrei):
//   { "login": { "pfad": "/login", "schritte": [["fill","#email","{meister_email}"],["fill","#passwort","{meister_passwort}"],["click","button[type=submit]"]] },
//     "rollen": { "meister": {"env":"MEISTER"}, "werkstatt": {"env":"WERKSTATT"} },
//     "seiten": { "tag": "/", "eingang": "/eingang/neu", "auftrag": "/auftraege/{auftrag}", "teil": "/auftraege/{auftrag}#teil-{teil}", "entwurf": { "pfad": "/kunden/{kunde}/bearbeiten", "schritte": [["fill","input[type=email]","x@y.de"],["press","Escape"]] }, … },
//     "vor": optional, JS-Funktionsquelltext `(a) => {…}`, läuft nach dem Laden (nur für Vorschau-Selbsttest/SPA-Zustand),
//     "muster": { "auftrag": "A-2026-0101", "teil": "T-03", "kunde": "K-2026-0011", "eingang": "M-13", "eingangsrechnung": "ER-2026-0001", "reklamation": "RK-2026-0001", "aufgabe": "AU-2" } }
// Zugangsdaten nur über Umgebungsvariablen, nie in Dateien: <ROLLE>_NAME (Person auf der Startkachel), <ROLLE>_PASSWORT (PIN oder Passwort), <ROLLE>_EMAIL.
// Runde 52c (PL 16:30/18:30): PIN-Anmeldung – Platzhalter auch im Selektor: {rolle_person} = <ROLLE>_NAME, {passwort_ziffer_1…n} = n-te Stelle von <ROLLE>_PASSWORT;
//   Schritt ["tippen", "<Selektor mit {ziffer}> | null", "{passwort}"] tippt die PIN Ziffer für Ziffer (Ziffernknopf je Stelle, ohne Selektor über die Tastatur).
//   Vercel-Freigabe: Umgebungsvariable aus routen.share_env (Standard VERCEL_SHARE) → beim ersten Aufruf ?_vercel_share=<Wert>.
//   Seiten mit "pfad": null und "grund" erscheinen gelb mit diesem Grund. Fokusreihenfolge (Sichtvertrag „fokus“) wird per Enter geprüft.
// Lintkonform ohne require(): Module per import() (CommonJS-Datei, damit der gebundene Pfad gleich bleibt).
const H = __dirname;
(async () => {
const { chromium } = await import('playwright');
const fs = await import('node:fs');
const path = await import('node:path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('app'); const ROUTEN = JSON.parse(fs.readFileSync(arg('routen', path.join(H, 'routen.json')), 'utf8'));
const NUR = (arg('nur', '') || '').split(',').filter(Boolean); const AUS = arg('aus', path.join(H, 'pruefbericht.json'));
if (!APP) { console.error('--app fehlt'); process.exit(2); }
const V = JSON.parse(fs.readFileSync(path.join(H, 'SICHTVERTRAG.json'), 'utf8'));
const routeFuer = s => ROUTEN.seiten[s.modus ? s.screen + '#' + s.modus : s.screen] || (s.modus ? null : undefined);
const pfad = (s) => { let p = routeFuer(s); if (p && typeof p === 'object') p = p.pfad; if (!p) return null; for (const [k, v] of Object.entries(ROUTEN.muster || {})) p = p.replace(`{${k}}`, v); return p; };
const PRUEFBAR = e => ['button', 'input', 'select', 'textarea', 'h1', 'h2', 'h3'].includes(e.tag) && e.kennung;
const b = await chromium.launch(); const bericht = { app: APP, zeit: new Date().toISOString(), seiten: [], summe: { gruen: 0, gelb: 0, rot: 0 } };
const ctxCache = {};
async function kontext(rolle) {
  if (ctxCache[rolle]) return ctxCache[rolle];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  const SHARE = process.env[ROUTEN.share_env || 'VERCEL_SHARE'];
  if (SHARE) { const u = new URL(APP + ((ROUTEN.login && ROUTEN.login.pfad) || '/')); u.searchParams.set('_vercel_share', SHARE); await p.goto(u.toString()).catch(() => {}); }
  if (ROUTEN.login) { await p.goto(APP + ROUTEN.login.pfad); const R = (ROUTEN.rollen || {})[rolle] || {}; const pre = R.env || rolle.toUpperCase();
    const pw = process.env[pre + '_PASSWORT'] || '';
    const ein = v => String(v ?? '').replace(/\{(?:\w+_)?email\}/g, () => process.env[pre + '_EMAIL'] || '').replace(/\{(?:\w+_)?passwort\}/g, () => pw)
      .replace(/\{(?:rolle_person|name|person)\}/g, () => process.env[pre + '_NAME'] || '').replace(/\{passwort_ziffer_(\d+)\}/g, (_, n) => pw.charAt(+n - 1));
    for (const [was, sel, wert] of ROUTEN.login.schritte) { const s1 = ein(sel), w = ein(wert);
      if (was === 'fill') await p.fill(s1, w); else if (was === 'click') await p.click(s1); else if (was === 'press') await p.keyboard.press(s1); else if (was === 'wait') await p.waitForTimeout(+sel);
      else if (was === 'tippen') { for (const z of (w || pw)) { if (sel) await p.click(String(sel).replace(/\{ziffer\}/g, z)); else await p.keyboard.type(z); await p.waitForTimeout(60); } } }
    await p.waitForLoadState('networkidle').catch(() => {}); }
  await p.close(); return (ctxCache[rolle] = ctx);
}
for (const s of V.seiten) {
  if (NUR.length && !NUR.includes(s.screen)) continue;
  const pf = pfad(s); const z = { screen: s.screen, ...(s.modus ? { modus: s.modus } : {}), rolle: s.rolle, groesse: s.groesse, befunde: [] };
  if (!pf) { const r0 = routeFuer(s); z.befunde.push({ stufe: 'gelb', was: r0 && typeof r0 === 'object' && r0.grund ? 'keine Route: ' + r0.grund : 'keine Route in routen.json' }); z.ampel = 'gelb'; bericht.seiten.push(z); bericht.summe.gelb++; continue; }
  const ctx = await kontext(s.rolle); const g = V.groessen[s.groesse]; const p = await ctx.newPage(); await p.setViewportSize({ width: g.breite, height: g.hoehe });
  try {
    await p.goto(APP + pf, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    if (ROUTEN.vor) { await p.evaluate(new Function('a', 'return (' + ROUTEN.vor + ')(a)'), { screen: s.screen, modus: s.modus || null, rolle: s.rolle, groesse: s.groesse, muster: ROUTEN.muster || {} }); await p.waitForTimeout(400); }
    const R = routeFuer(s); // Seiten, die erst nach einer Bedienung erscheinen (z. B. Rückfrage „Entwurf“): schritte [["fill",sel,wert],["click",sel],["press","Escape"],["wait",ms]]
    for (const [was, sel, wert] of (R && typeof R === 'object' && R.schritte) || []) { if (was === 'fill') await p.fill(sel, wert); else if (was === 'click') await p.click(sel); else if (was === 'press') await p.keyboard.press(sel); else if (was === 'wait') await p.waitForTimeout(+sel); }
    if (R && typeof R === 'object' && R.schritte) await p.waitForTimeout(300);
    const soll = s.elemente.filter(PRUEFBAR);
    let ist = await p.evaluate(([w, h]) => {
      const inVp = r => r.bottom > 0 && r.top < h && r.right > 0 && r.left < w;
      const sl = t => String(t || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      const dlg = [...document.querySelectorAll('[data-ebene], [role=dialog], dialog[open], [aria-modal=true]')].pop();
      return [...document.querySelectorAll('button, a, input, select, textarea, h1, h2, h3, [data-spec-id]')].map((el, n) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); const tag = el.tagName.toLowerCase();
        const txt = ['input', 'select', 'textarea'].includes(tag) ? (el.getAttribute('aria-label') || el.placeholder || '') : (el.innerText || el.getAttribute('aria-label') || '').trim().split('\n')[0].slice(0, 60);
        return { sid: el.dataset.specId || null, slug: sl(txt), tag, text: txt, im_dialog: !!(dlg && dlg.contains(el)), sichtbar: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden', im_viewport: inVp(r), h: Math.round(r.height), hintergrund: cs.backgroundColor, n }; }); }, [g.breite, g.hoehe]);
    // Vorschau zeigt eine Ebene (Dialog): dann zählt nur die oberste Ebene der App, nicht die Seite dahinter
    if (s.ebene === 'dialog' && ist.some(i => i.im_dialog)) ist = ist.filter(i => i.im_dialog);
    // Kennungen mit Platzhaltern ({auftrag}, {teil} …) passen auf jeden Wert an dieser Stelle
    const muster = k => new RegExp('^' + String(k).replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{[a-z_]+\\?\}/g, '[^.]+') + '$');
    const passt = (e, i) => (!e.tag || i.tag === e.tag || (e.tag === 'button' && i.tag === 'a')) && (e.kennung.includes('.') ? !!i.sid && muster(e.kennung).test(i.sid) : (i.slug === e.kennung || (!!i.sid && muster(e.kennung).test(i.sid))));
    let letzteN = -1; const benutzt = new Set();
    const finde = (e, frei) => { const w = ist.find(i => i.n > letzteN && (frei || !benutzt.has(i.n)) && passt(e, i)) || ist.find(i => (frei || !benutzt.has(i.n)) && passt(e, i)); if (w && !frei) benutzt.add(w.n); return w; };
    for (const e of soll) {
      const i = finde(e);
      if (!i) { z.befunde.push({ stufe: e.tag === 'button' ? 'rot' : 'gelb', was: 'fehlt', kennung: e.kennung, tag: e.tag, text: e.text }); continue; }
      if (!i.sichtbar) z.befunde.push({ stufe: 'rot', was: 'unsichtbar', kennung: e.kennung });
      if (e.sichtbar_im_viewport && !i.im_viewport) z.befunde.push({ stufe: 'gelb', was: 'nicht im Viewport (Vorschau: sichtbar)', kennung: e.kennung });
      if (e.tag === 'button' && i.h < Math.min(e.lage.h, 44) - 2) z.befunde.push({ stufe: 'rot', was: `zu klein (${i.h}px, Vorschau ${e.lage.h}px)`, kennung: e.kennung });
      if (e.tag === 'button' && e.stil.hintergrund !== 'rgba(0, 0, 0, 0)' && i.hintergrund !== e.stil.hintergrund) z.befunde.push({ stufe: 'gelb', was: `Farbe ${i.hintergrund} statt ${e.stil.hintergrund}`, kennung: e.kennung });
      if (i.n < letzteN) z.befunde.push({ stufe: 'gelb', was: 'Reihenfolge weicht ab', kennung: e.kennung }); else letzteN = i.n;
    }
    if (s.kopf) { const k = await p.evaluate(() => { const t = [...document.querySelectorAll('[data-ebene], [role=dialog], dialog[open]')].pop(); const h = t ? (t.querySelector('h2') || t.querySelector('header b, h1')) : (document.querySelector('main h1, .kr-seite-titel') || document.querySelector('h1')); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; });
      if (!k.includes(s.kopf)) z.befunde.push({ stufe: 'rot', was: `Kopf „${k}“ enthält nicht den Seitennamen „${s.kopf}“` });
      if (s.modus_titel && s.modus_titel !== s.kopf && !k.includes(s.modus_titel)) z.befunde.push({ stufe: 'rot', was: `Modus-Unterzeile „${s.modus_titel}“ fehlt im Kopf` }); }
    if (s.hauptaktion) { const i = finde({ kennung: s.hauptaktion.kennung }, true); if (!i) z.befunde.push({ stufe: 'rot', was: 'Hauptaktion fehlt', kennung: s.hauptaktion.kennung });
      else if (s.hauptaktion.im_viewport && !i.im_viewport) z.befunde.push({ stufe: s.hauptaktion.je_zeile ? 'gelb' : 'rot', was: 'Hauptaktion nicht im Viewport ohne Scrollen', kennung: s.hauptaktion.kennung }); }
    // Runde 52c (U-240): Fokusreihenfolge – Enter springt ins nächste Feld wie im Sichtvertrag; Enter im letzten Pflichtfeld wird nicht gedrückt (Hauptaktion)
    if (s.fokus && s.fokus.felder.length >= 2) { const fl = s.fokus.felder, bis = Math.min(s.fokus.enter_bis, fl.length - 1);
      const kennung = () => p.evaluate(() => { const f = document.activeElement; if (!f || !f.matches || !f.matches('input, select, textarea')) return null; const sl = t => String(t || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        const L = (f.closest('.kr-feld') || {}).querySelector?.('.kr-feld-label') || f.closest('label') || (f.id && document.querySelector('label[for="' + f.id + '"]'));
        const lt = L ? [...L.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : ''; return f.dataset.specId || sl(lt || f.getAttribute('aria-label') || f.placeholder || f.name || f.type); });
      const start = await p.evaluate(k0 => { const sl = t => String(t || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); const re = new RegExp('^' + k0.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{[a-z_]+\\?\}/g, '[^.]+') + '$');
        const el = [...document.querySelectorAll('input, select, textarea')].find(f => { const L = (f.closest('.kr-feld') || {}).querySelector?.('.kr-feld-label') || f.closest('label'); const lt = L ? [...L.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : ''; return re.test(f.dataset.specId || sl(lt || f.getAttribute('aria-label') || f.placeholder || f.name || f.type)); });
        if (el) el.focus(); return !!el; }, fl[0].kennung);
      if (!start) z.befunde.push({ stufe: 'gelb', was: 'Fokusreihenfolge: erstes Feld nicht gefunden', kennung: fl[0].kennung });
      else for (let n = 1; n <= bis; n++) { await p.keyboard.press('Enter'); await p.waitForTimeout(90); const k = await kennung();
        if (!k || !muster(fl[n].kennung).test(k)) { z.befunde.push({ stufe: 'rot', was: `Fokusreihenfolge: nach „${fl[n - 1].kennung}“ springt Enter auf „${k || 'nichts'}“ statt „${fl[n].kennung}“`, kennung: fl[n].kennung }); break; } } }
    z.soll = soll.length; z.gefunden = soll.length - z.befunde.filter(x => x.was === 'fehlt').length;
    await p.screenshot({ path: path.join(H, 'pruefbilder_app', `${s.screen}_${s.rolle}_${s.groesse}.png`) }).catch(() => {});
  } catch (err) { z.befunde.push({ stufe: 'rot', was: 'Seite nicht ladbar: ' + err.message.split('\n')[0] }); }
  await p.close();
  const rot = z.befunde.filter(x => x.stufe === 'rot').length, gelb = z.befunde.filter(x => x.stufe === 'gelb').length;
  z.ampel = rot ? 'rot' : gelb ? 'gelb' : 'gruen'; bericht.summe[z.ampel]++; bericht.seiten.push(z);
  console.log(z.ampel.toUpperCase().padEnd(5), `${s.screen}${s.modus ? '#' + s.modus : ''}/${s.rolle}/${s.groesse}`, `${z.gefunden ?? 0}/${z.soll ?? 0}`, rot ? `rot ${rot}` : '', gelb ? `gelb ${gelb}` : '');
}
await b.close();
fs.mkdirSync(path.join(H, 'pruefbilder_app'), { recursive: true }); fs.writeFileSync(AUS, JSON.stringify(bericht, null, 1));
const md = ['# Sichtprüfung gegen SICHTVERTRAG', `App: ${APP} · ${bericht.zeit}`, `Grün ${bericht.summe.gruen} · Gelb ${bericht.summe.gelb} · Rot ${bericht.summe.rot}`, '',
  ...bericht.seiten.filter(z => z.ampel !== 'gruen').map(z => `## ${z.ampel.toUpperCase()} ${z.screen} · ${z.rolle} · ${z.groesse}\n` + z.befunde.map(f => `- ${f.stufe}: ${f.was}${f.kennung ? ' · `' + f.kennung + '`' : ''}${f.text ? ' · „' + f.text + '“' : ''}`).join('\n'))];
fs.writeFileSync(AUS.replace(/\.json$/, '.md'), md.join('\n') + '\n');
console.log('Bericht:', AUS, '| Grün', bericht.summe.gruen, 'Gelb', bericht.summe.gelb, 'Rot', bericht.summe.rot);
process.exit(bericht.summe.rot ? 1 : 0);
})();
