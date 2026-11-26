import type {TagQuelle} from '@/lib/today/todaySourceRegistry';

export const tagQuellen = [
  {id: 'eingang.nachrichten', modul: 'eingang', bereich: null, rang: null, bestand: {leser: 'messages', umfang: 'mandant'}},
] as const satisfies readonly TagQuelle[];
