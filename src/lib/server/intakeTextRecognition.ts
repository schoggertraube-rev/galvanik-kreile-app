import "server-only";
import { berlinCalendarDay } from "@/lib/domain/workingDays";

export type IntakeTextRecognitionField = {
  field: "companyName" | "email" | "phone" | "zipCode" | "city" | "dueDate";
  value: string;
  source: string;
};

export type IntakeTextRecognitionPosition = {
  name: string;
  quantity: string;
  unit: "Stück" | "kg";
  surfaceRequested: string;
  surfaceRecognized?: boolean;
  executionRequested: "hochglanz" | "glaenzend" | "matt" | "gelb_passiviert" | "blau_passiviert" | "offen";
  source: string;
};

export type IntakeTextRecognition = {
  quoteChanges?: {quoteNumber?:{year:string|null;number:number};quantity?:{value:number;name:string;mode:'replace'|'add';previous?:number};hours?:string;targetNetCents?:number};
  fields: IntakeTextRecognitionField[];
  positions: IntakeTextRecognitionPosition[];
  totalPositions?: number;
  overflowPositions?: IntakeTextRecognitionPosition[];
  deliveryWeeks?: {value:number;source:string};
  instructions?: Array<{text:string;source:string}>;
};

const SURFACES: Array<{ pattern: RegExp; surface: string }> = [
  { pattern: /\b(?:chrom|verchrom(?:t|en)?)\b/i, surface: "Verchromen" },
  { pattern: /\b(?:nickel|vernickel(?:t|n)?)\b/i, surface: "Vernickeln" },
  { pattern: /\b(?:zink|verzink(?:t|en)?)\b/i, surface: "Verzinken" },
  { pattern: /\bentchrom(?:en|t)?\b/i, surface: "Entchromen / prüfen" },
];

const EXECUTIONS: Array<{ pattern: RegExp; execution: IntakeTextRecognitionPosition["executionRequested"] }> = [
  { pattern: /\bhochglanz\b/i, execution: "hochglanz" },
  { pattern: /\b(?:glanz|glänzend)\b/i, execution: "glaenzend" },
  { pattern: /\bmatt\b/i, execution: "matt" },
  { pattern: /\bgelb(?:\s+passiviert)?\b/i, execution: "gelb_passiviert" },
  { pattern: /\bblau(?:\s+passiviert)?\b/i, execution: "blau_passiviert" },
];

const NUMBER_WORDS: Record<string, string> = {
  eins: "1", ein: "1", eine: "1", zwei: "2", drei: "3", vier: "4", fünf: "5", sechs: "6",
  sieben: "7", acht: "8", neun: "9", zehn: "10", elf: "11", zwölf: "12", zwanzig: "20",
  dreißig: "30", hundert: "100", "ein dutzend": "12", "ein paar": "", einige: "",
};
const WEEKDAYS: Record<string, number> = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6 };

function nextDate(day: number, month: number, year: number | null, today: Date): string | null {
  const fullYear = year === null ? today.getUTCFullYear() : year < 100 ? 2000 + year : year;
  let candidate = new Date(Date.UTC(fullYear, month - 1, day));
  if (candidate.getUTCDate() !== day || candidate.getUTCMonth() !== month - 1) return null;
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (year === null && candidate < todayStart) candidate = new Date(Date.UTC(fullYear + 1, month - 1, day));
  return candidate.toISOString().slice(0, 10);
}

export function recognizeIntakeText(text: string, today = new Date()): IntakeTextRecognition {
  if (text.length > 20_000) throw new Error("INTAKE_TEXT_TOO_LONG");
  const normalized = text.trim();
  if (!normalized) return { fields: [], positions: [] };
  const fields: IntakeTextRecognitionField[] = [];
  const berlinToday = new Date(`${berlinCalendarDay(today)}T00:00:00.000Z`);
  const addField = (field: IntakeTextRecognitionField["field"], value: string, source: string) => {
    if (!fields.some((entry) => entry.field === field)) fields.push({ field, value, source });
  };

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = normalized.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  if (email) addField("email", email, `Text Zeile ${Math.max(1, lines.findIndex((line) => line.includes(email)) + 1)}`);
  const phone = normalized.match(/(?:\+49|0049|0)[\d\s/()-]{5,}\d/)?.[0]?.trim();
  if (phone && phone.replace(/\D/g, "").length >= 6) addField("phone", phone, `Text Zeile ${Math.max(1, lines.findIndex((line) => line.includes(phone)) + 1)}`);
  const address = normalized.match(/\b(\d{5})\s+([\p{L}][\p{L}\s.-]{1,80})/u);
  if (address) {
    addField("zipCode", address[1]!, "Text");
    addField("city", address[2]!.trim().split(/[,;\n]/)[0]!, "Text");
  }
  const companyLine = lines.find((line) => /\b(?:GmbH|UG|AG|KG|OHG|GbR|e\.\s*K\.|e\.\s*V\.)\b/i.test(line));
  if (companyLine) addField("companyName", companyLine.slice(0, 160), `Text Zeile ${lines.indexOf(companyLine) + 1}`);
  const requestText = normalized.split(/\r?\n(?:--\s*|mit freundlichen gr[üu][ßs]en\b)/i, 1)[0]!;
  const corrected = requestText.replace(/\b(?:nicht|kein(?:e|en)?)\s+[^,;\n]{1,80}?,\s*(?:nur|sondern)\s+/gi, "");
  // Ein Mail- oder Signaturdatum ist kein Lieferwunsch; nur ausdrücklich eingeleitete Termine übernehmen.
  const dateMatch = corrected.match(/\b(?:bis|zum|(?:liefer)?termin(?:\s+(?:auf|bitte))?)\s+(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4}))?/i);
  if (dateMatch) {
    const value = nextDate(Number(dateMatch[1]), Number(dateMatch[2]), dateMatch[3] ? Number(dateMatch[3]) : null, berlinToday);
    if (value) addField("dueDate", value, "Text");
  } else {
    const weekdayMatch = corrected.match(/(?:\bbis\s+|\b(?:bis\s+)?nächste\s+woche\s+)(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i);
    if (weekdayMatch) {
      const target = WEEKDAYS[weekdayMatch[1]!.toLowerCase()]!;
      const date = new Date(berlinToday);
      const delta = /nächste\s+woche/i.test(weekdayMatch[0])
        ? ((8 - date.getUTCDay()) % 7 || 7) + (target + 6) % 7
        : (target - date.getUTCDay() + 7) % 7;
      date.setUTCDate(date.getUTCDate() + delta);
      addField("dueDate", date.toISOString().slice(0, 10), "Text");
    }
  }

  const positions = corrected.split(/\r?\n|;|,(?=\s*\d)|\s+und\s+/i).flatMap((part, index) => {
    const content=part.trim().replace(/^bitte\s+/i, "");
    const explicit=content.match(/^(\d+(?:[.,]\d+)?|ein dutzend|ein paar|eins|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|hundert|einige)\s*(kg|Stück|Stk\.?|St\.?|Teile|x)\b\s*(.*)$/i);
    // A counted part with an explicit treatment needs no word "Stück".
    // A bare time or money amount is never turned into a workshop position.
    const counted=!explicit&&SURFACES.some(entry=>entry.pattern.test(content))?content.match(/^(\d+|ein|eine|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+(.+)$/i):null;
    const quantityMatch=explicit??(counted?[counted[0],counted[1],'Stück',counted[2]]:null);
    if (!quantityMatch) return [];
    const surface = SURFACES.find((entry) => entry.pattern.test(part));
    const execution = EXECUTIONS.find((entry) => entry.pattern.test(part));
    let name = quantityMatch[3]!.trim().split(/,\s*(?:KV\b|in\s+(?:\d+|ein\w*|zwei|drei|vier)\s+Wochen?\b)/i,1)[0]!;
    for (const entry of [...SURFACES, ...EXECUTIONS]) name = name.replace(entry.pattern, " ");
    name = name.replace(/\s+/g, " ").replace(/^[,.-]+|[,.-]+$/g, "").trim();
    if (!name && /^teile$/i.test(quantityMatch[2]!)) name = "Teile";
    if (name.length < 2) return [];
    return [{
      name,
      quantity: NUMBER_WORDS[quantityMatch[1]!.toLowerCase()] ?? quantityMatch[1]!.replace(",", "."),
      unit: /^kg$/i.test(quantityMatch[2]!) ? "kg" as const : "Stück" as const,
      surfaceRequested: surface?.surface ?? "noch zu klären",
      surfaceRecognized: Boolean(surface),
      executionRequested: execution?.execution ?? "offen",
      source: `Text Abschnitt ${index + 1}`,
    }];
  });

  const lead=corrected.match(/\bin\s+(\d{1,2}|einer|ein|eine|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+Wochen?\b/i);
  const weeks=lead?(lead[1]!.toLocaleLowerCase('de-DE')==='einer'?1:Number(NUMBER_WORDS[lead[1]!.toLocaleLowerCase('de-DE')]??lead[1])):null;
  const negatedLead=lead&&/\b(?:nicht|keine|ohne)\s*$/i.test(corrected.slice(0,lead.index));
  const deliveryWeeks=lead&&!negatedLead&&weeks!==null&&Number.isSafeInteger(weeks)&&weeks>=1&&weeks<=52?{value:weeks,source:lead[0]}:null;
  const instructions=requestText.split(/[;\n]+|(?<=[.!?])\s+/u).map(text=>text.trim()).filter(text=>text&&/\b(?:nicht|kein(?:e|en)?|nur|erhalten|abdecken|ausschließen|ohne)\b/iu.test(text)).map(text=>({text,source:'Originaltext'}));
  const quoteChanges:NonNullable<IntakeTextRecognition['quoteChanges']>={};
  const quoteReference=corrected.match(/\bKV(?:[-\s]*(\d{4})-)?[-\s]*(\d{1,9})\b/i);
  if(quoteReference)quoteChanges.quoteNumber={year:quoteReference[1]??null,number:Number(quoteReference[2])};
  const quantityChange=corrected.match(/\b(?:(noch)\s+)?(\d+)\s+(?:St[üu]ck\s+)?([\p{L}][\p{L} -]*?)(?:\s+statt\s+(\d+)|\s+(dazu))\b/iu);
  if(quantityChange&&!/(?:\b(?:nicht|keine?|ohne)|-)\s*$/i.test(corrected.slice(0,quantityChange.index)))quoteChanges.quantity={value:Number(quantityChange[2]),name:quantityChange[3].trim(),mode:quantityChange[5]?'add':'replace',...(quantityChange[4]?{previous:Number(quantityChange[4])}:{})};
  const hoursChange=corrected.match(/\b(?:Arbeitszeit\s*(?:auf\s*)?)?(\d+(?:[.,]\d{1,4})?)\s*(?:Stunden?|Std\.?|h)\b/iu);
  if(hoursChange&&!/(?:\b(?:nicht|keine?|ohne)|-)\s*$/i.test(corrected.slice(0,hoursChange.index)))quoteChanges.hours=hoursChange[1].replace(',','.');
  const priceChange=corrected.match(/\b(?:Preis(?:ziel)?(?:\s+auf)?|auf)\s+(\d{1,9}(?:[.,]\d{1,2})?)\s*(?:Euro|€)/iu);
  if(priceChange){const [whole,fraction='']=priceChange[1].replace(',','.').split('.');quoteChanges.targetNetCents=Number(BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,'0')));}
  return { ...(Object.keys(quoteChanges).length?{quoteChanges}:{}),fields, positions: positions.slice(0, 20), ...(positions.length > 20 ? { totalPositions: positions.length, overflowPositions: positions.slice(20) } : {}),...(deliveryWeeks?{deliveryWeeks}:{}),...(instructions.length?{instructions}:{}) };
}
