import type {TagQuelle} from '@/lib/today/todaySourceRegistry';

export const tagQuellen = [
  {id: 'accounting.geld', modul: 'accounting', bereich: null, rang: null, bestand: {leser: 'money', umfang: 'mandant'}},
] as const satisfies readonly TagQuelle[];
