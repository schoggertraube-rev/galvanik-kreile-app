export type NoteConcern={id:string;label:string};
// The signal vocabulary is eingang.anliegen in the frozen AP-EIN specification.
const NOTE_SIGNALS = [
  { id: "rueckruf", label: "Rückruf", pattern: /ruft zurück|rückruf|zurückrufen|bitte anrufen|rufen sie mich|melden sie sich|mailbox|call back/iu },
  { id: "frist", label: "Frist", pattern: /frist|bis zum|spätestens|mahnung|bescheid|behörde|widerspruch/iu },
  { id: "aufgabe", label: "Aufgabe (intern)", pattern: /\bbitte\b|erledigen|kannst du|maschine|störung/iu },
  { id: "hinweis", label: "Hinweis zur Bearbeitung", pattern: /bitte beachten|abdecken|\bnur\b|verpacken|vorsicht|maskieren|sie hatten|wie besprochen/iu },
  { id: "preis_einwand", label: "Preis klären", pattern: /preis passt nicht|zu teuer|rechnung stimmt nicht/iu },
  { id: "nachfrage", label: "Nachfrage", pattern: /teile fertig|stand der teile/iu },
  { id: "kundendaten", label: "Kundendaten", pattern: /rechnung an|rechnungs.?e.?mail/iu },
] as const;
const NEGATED_SIGNAL = /\b(?:nicht|kein|keine|keinen|entfällt|erledigt|ohne|bereits|schon)\b/iu;
const MAIL_QUOTE_REQUEST = {
  id: 'kv_anfrage', label: 'KV-Anfrage',
  pattern: /\b(?:angebotsanfrage|kv[-\s]*anfrage)\b|\b(?:erstellen|benötige|benötigen|brauche|brauchen)\b.{0,100}\b(?:kostenvoranschlag|angebot|kv)\b|\b(?:kostenvoranschlag|angebot|kv)\b.{0,100}\b(?:erstellen|anfragen|anfordern)\b/iu,
};
export function recognizeNoteConcerns(text: string, source: 'note' | 'mail' = 'note'): NoteConcern[] {
  const sentences=text.split(/[.!?;\n]+/u).filter(sentence=>source!=='mail'||!/^\s*>/u.test(sentence));
  const signals=source==='mail'?[...NOTE_SIGNALS,MAIL_QUOTE_REQUEST]:NOTE_SIGNALS;
  return signals.filter(signal=>sentences.some(sentence=>{
    const match=signal.pattern.exec(sentence);if(!match)return false;
    if(signal.id==='kv_anfrage'&&/\b(?:nicht|kein|keine|keinen|keinem|keiner)\b/iu.test(sentence))return false;
    // A request is not an extra generic task merely because it says "bitte".
    if(signal.id==='aufgabe'&&source==='mail'&&MAIL_QUOTE_REQUEST.pattern.test(sentence))return false;
    if(signal.id==="aufgabe"&&(NEGATED_SIGNAL.test(sentence)||/\bnur\b|zurückrufen|anrufen|rufen sie mich|rechnung an/iu.test(sentence)))return false;
    return !NEGATED_SIGNAL.test(sentence.slice(0,match.index));
  })).map(({id,label})=>({id,label}));
}
