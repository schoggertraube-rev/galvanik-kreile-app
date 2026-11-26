import type {TagQuelle} from '@/lib/today/todaySourceRegistry';

export const tagQuellen = [
  {id: 'quotes.nachfassen', modul: 'quotes', bereich: null, rang: null, bestand: {leser: 'quote_followups', umfang: 'mandant'}},
  {id: 'quotes.liste', modul: 'quotes', bereich: null, rang: null, bestand: {leser: 'quotes', umfang: 'mandant'}},
] as const satisfies readonly TagQuelle[];
