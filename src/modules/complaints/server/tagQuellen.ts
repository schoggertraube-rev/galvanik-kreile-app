import type {TagQuelle} from '@/lib/today/todaySourceRegistry';

export const tagQuellen = [
  {id: 'complaints.liste', modul: 'complaints', bereich: null, rang: null, bestand: {leser: 'complaints', umfang: 'mandant'}},
] as const satisfies readonly TagQuelle[];
