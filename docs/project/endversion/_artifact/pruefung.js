/* Kreile Endversion · Sackgassen-Check (läuft im Browser und in Node)
   Prüft: jede Aktion hat ein gültiges Ziel · jeder Screen ist je Rolle erreichbar · jedes Overlay hat einen Ausweg ·
   jeder Zustand (leer/teilweise/fehler/erfolg) hat einen Ausweg · Bauumfang Stufe 1 ist abgedeckt · Abläufe ohne Bruch. */
(function (wurzel) {
  'use strict';
  const PFLICHT_ZUSTAENDE = ['leer', 'teilweise', 'fehler', 'erfolg'];
  const OVERLAY = ['dialog', 'blatt', 'menue', 'palette'];
  const SPEZIAL = ['start', 'zurueck'];

  function funktionAn(spec, fid, konf) {
    if (!fid) return true;
    const f = spec.funktionen.find(x => x.id === fid);
    if (!f) return false;
    if (f.stufe == null) return false;
    if (f.addon) return konf.stufen.includes(f.stufe) && konf.addons.includes(f.addon);
    return konf.stufen.includes(f.stufe);
  }

  /* Sammelt alle Aktionen (Objekte mit "ziel") samt geerbter Funktion/Rolle/Zustand */
  function aktionenVon(spec, sc) {
    const aus = [];
    const lauf = (o, ctx, pfad) => {
      if (Array.isArray(o)) { o.forEach((x, n) => lauf(x, ctx, pfad + '[' + n + ']')); return; }
      if (!o || typeof o !== 'object') return;
      const c = { funktion: o.funktion && typeof o.funktion === 'string' ? o.funktion : ctx.funktion, rollen: o.rollen || ctx.rollen, zustand: ctx.zustand };
      if (typeof o.ziel === 'string') aus.push({ ziel: o.ziel, arg: o.arg, text: o.text || o.label || o.titel || o.lbl || '', funktion: c.funktion, rollen: c.rollen, zustand: c.zustand, pfad });
      if (o.typ === 'hb' && spec.beispiel && spec.beispiel.hb && spec.beispiel.hb[o.quelle]) lauf(spec.beispiel.hb[o.quelle], c, pfad + '.hb');
      if (o.typ === 'picker' && o.ziele) Object.values(o.ziele).forEach(z => aus.push({ ziel: z, text: 'Auswahl', funktion: c.funktion, rollen: c.rollen, pfad: pfad + '.ziele' }));
      if (o.typ === 'ausgrau') aus.push({ ziel: 'stufenseite', text: o.text, funktion: o.funktion, rollen: c.rollen, implizit: true, pfad });
      if (o.typ === 'kachel' && o.liste && o.zeilenAktion) aus.push({ ...o.zeilenAktion, funktion: c.funktion, rollen: c.rollen, pfad: pfad + '.zeilenAktion' });
      if (o.typ === 'liste') aus.push({ ziel: o.ziel, text: 'Listeneintrag', funktion: c.funktion, rollen: c.rollen, pfad });
      for (const [k, v] of Object.entries(o)) {
        if (k === 'zustaende') { for (const [zn, zv] of Object.entries(v)) lauf(zv, { ...c, zustand: zn }, pfad + '.zustaende.' + zn); }
        else if (v && typeof v === 'object' && k !== 'zeilenAktion') lauf(v, c, pfad + '.' + k);
      }
    };
    lauf({ inhalt: sc.inhalt, aktionen: sc.aktionen, werkzeug: sc.werkzeug, zustaende: sc.zustaende }, { funktion: undefined, rollen: undefined }, sc.id);
    return aus;
  }

  function navKanten(spec, rolle) {
    const r = spec.rollen.find(x => x.id === rolle); const n = spec.navigation; const k = [...n.kopf];
    if (r.shell === 'werkstatt') k.push(...n.werkstatt); else k.push(...n.buero.filter(x => !x.trenner), ...n.dock);
    return k.map(x => ({ ziel: x.ziel, arg: x.arg, text: x.label, funktion: x.funktion, rollen: x.rollen, pfad: 'navigation.' + x.id }));
  }

  function pruefe(spec, konf) {
    konf = konf || { stufen: [1], addons: [] };
    const fehler = [], hinweise = [], kanten = {};
    const S = Object.fromEntries(spec.screens.map(s => [s.id, s]));
    const add = (arr, art, text, wo) => arr.push({ art, text, wo });

    // 1 · Ziele gültig, Aktionen haben Ziel
    for (const sc of spec.screens) {
      const ak = aktionenVon(spec, sc); kanten[sc.id] = ak;
      for (const a of ak) {
        if (!a.ziel) { add(fehler, 'Ziel fehlt', `„${a.text}“ hat kein Ziel`, a.pfad); continue; }
        if (SPEZIAL.includes(a.ziel) || a.ziel.startsWith('extern:')) continue;
        if (a.ziel.startsWith('zustand:')) {
          const z = a.ziel.slice(8); const zs = (sc.zustaende || {})[z];
          if (z !== 'daten' && (!zs || zs.na)) add(fehler, 'Zustand fehlt', `„${a.text}“ → Zustand „${z}“ existiert nicht`, a.pfad);
          continue;
        }
        if (!S[a.ziel]) add(fehler, 'Ziel unbekannt', `„${a.text}“ → „${a.ziel}“ gibt es nicht`, a.pfad);
      }
      const leer = (o, pfad) => { if (Array.isArray(o)) o.forEach((x, n) => { if (x && typeof x === 'object' && !x.ziel && !x.typ && (x.text || x.icon)) add(fehler, 'Ziel fehlt', `„${x.text || x.icon}“ hat kein Ziel`, pfad + '[' + n + ']'); }); };
      leer(sc.aktionen, sc.id + '.aktionen');
      // 2 · Ausweg aus Overlays
      if (OVERLAY.includes(sc.typ) && !(sc.aktionen || []).some(a => a.ziel === 'zurueck')) add(fehler, 'Kein Ausweg', `${sc.typ} „${sc.titel}“ hat kein „Schließen/Zurück“`, sc.id);
      // 3 · Zustände
      for (const z of PFLICHT_ZUSTAENDE) {
        const zs = (sc.zustaende || {})[z];
        if (!zs) { add(fehler, 'Zustand fehlt', `„${sc.titel}“: Zustand „${z}“ nicht beschrieben`, sc.id); continue; }
        if (zs.na) { if (typeof zs.na !== 'string' || !zs.na.trim()) add(fehler, 'Zustand ohne Grund', `„${sc.titel}“: „${z}“ = n. z. ohne Grund`, sc.id); continue; }
        if (!(zs.aktionen || []).length) add(fehler, 'Zustand ohne Ausweg', `„${sc.titel}“: Zustand „${z}“ hat keine Aktion`, sc.id + '.zustaende.' + z);
      }
      for (const [z, zs] of Object.entries(sc.zustaende || {})) if (!PFLICHT_ZUSTAENDE.includes(z) && !zs.na && !(zs.aktionen || []).length) add(fehler, 'Zustand ohne Ausweg', `„${sc.titel}“: Zustand „${z}“ hat keine Aktion`, sc.id);
      if (sc.status === 'vorschlag') add(hinweise, 'Vorschlag', `„${sc.titel}“ ist Vorschlag (${sc.freigabe || 'Owner'}) – bis Freigabe nicht bauen`, sc.id);
    }

    // 4 · Erreichbarkeit je Rolle
    const erreichbar = {};
    for (const r of spec.rollen) {
      const darf = a => !a.rollen || a.rollen.includes(r.id);
      const offen = new Set(), stapel = ['login'];
      const nk = navKanten(spec, r.id).filter(a => darf(a) && funktionAn(spec, a.funktion, konf));
      while (stapel.length) {
        const id = stapel.pop(); if (offen.has(id)) continue; const sc = S[id]; if (!sc) continue;
        if (sc.rollen && !sc.rollen.includes(r.id)) continue;
        offen.add(id);
        const ziele = (kanten[id] || []).filter(a => darf(a) && funktionAn(spec, a.funktion, konf)).concat(id === 'login' ? [] : nk);
        for (const a of ziele) { const z = a.ziel === 'start' ? r.start : a.ziel; if (S[z] && !offen.has(z)) stapel.push(z); }
      }
      erreichbar[r.id] = offen;
      for (const sc of spec.screens) {
        if (!sc.rollen || !sc.rollen.includes(r.id) || offen.has(sc.id)) continue;
        const fs = (sc.funktion || []); const aktiv = sc.status === 'platzhalter' ? false : (!fs.length || fs.some(f => funktionAn(spec, f, konf)));
        if (aktiv) add(fehler, 'Nicht erreichbar', `„${sc.titel}“ ist für ${r.person} (${r.id}) nicht erreichbar`, sc.id);
      }
    }
    for (const sc of spec.screens) if (!Object.values(erreichbar).some(s => s.has(sc.id)) && sc.status !== 'platzhalter' && (sc.funktion || []).some(f => funktionAn(spec, f, konf))) add(fehler, 'Nicht erreichbar', `„${sc.titel}“ für niemanden erreichbar`, sc.id);

    // 5 · Bauumfang-Abdeckung
    const genutzt = new Set(); JSON.stringify(spec.screens, (k, v) => { if (k === 'funktion') (Array.isArray(v) ? v : [v]).forEach(x => genutzt.add(x)); return v; });
    JSON.stringify(spec.navigation, (k, v) => { if (k === 'funktion') genutzt.add(v); return v; });
    for (const f of spec.funktionen) {
      if (!genutzt.has(f.id)) add(f.stufe === 1 ? fehler : hinweise, 'Nicht abgedeckt', `${f.id} ${f.name} (Stufe ${f.stufe ?? '–'}) kommt in keinem Screen vor`, 'funktionen');
      if (f.stufe == null) add(hinweise, 'Ohne Stufe', `${f.id} ${f.name}: ${f.grund} → grau „geplant“, Owner entscheidet`, 'funktionen');
    }
    for (const id of genutzt) if (!spec.funktionen.some(f => f.id === id)) add(fehler, 'Funktion unbekannt', `Funktion „${id}“ steht nicht im Funktionskatalog`, 'screens');
    for (const s of spec.stufen) if (s.status === 'annahme') add(hinweise, 'Annahme', `Stufe ${s.n} = ${s.name} (${s.grund})`, 'stufen');

    // 6 · Abläufe ohne Bruch (roter Faden)
    const verbunden = (a, b, vorher) => {
      const [sa, za] = a.split('#'), [sb, zb] = b.split('#');
      if (sa === sb) return !zb || (kanten[sa] || []).some(k => k.ziel === 'zustand:' + zb) || !!za;
      const alle = (kanten[sa] || []).concat(S[sa] && S[sa].typ === 'login' ? [] : spec.rollen.flatMap(r => navKanten(spec, r.id)));
      const zurueck = vorher && vorher.split('#')[0] === sb && (kanten[sa] || []).some(k => k.ziel === 'zurueck');
      return zurueck || alle.some(k => k.ziel === sb || (k.ziel === 'start' && spec.rollen.some(r => r.start === sb)));
    };
    for (const fl of spec.flows) for (const w of [fl.schritte, ...(fl.varianten || [])]) {
      w.forEach(s => { if (!S[s.split('#')[0]]) add(fehler, 'Ablauf', `${fl.id} ${fl.name}: Schritt „${s}“ gibt es nicht`, fl.id); });
      for (let n = 1; n < w.length; n++) if (!verbunden(w[n - 1], w[n], w[n - 2])) add(fehler, 'Ablauf unterbrochen', `${fl.id} ${fl.name}: kein Weg von „${w[n - 1]}“ nach „${w[n]}“`, fl.id);
    }

    const zahl = Object.values(kanten).reduce((s, a) => s + a.length, 0);
    return { ok: fehler.length === 0, fehler, hinweise, kanten, erreichbar: Object.fromEntries(Object.entries(erreichbar).map(([k, v]) => [k, [...v]])), zahlen: { screens: spec.screens.length, aktionen: zahl, flows: spec.flows.length, konf } };
  }

  const api = { pruefe, funktionAn, aktionenVon };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else wurzel.KreilePruefung = api;
})(typeof window !== 'undefined' ? window : globalThis);
