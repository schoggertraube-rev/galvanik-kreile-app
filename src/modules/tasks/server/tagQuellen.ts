import type {TagQuelle} from '@/lib/today/todaySourceRegistry';

export const tagQuellen = [
  {id: 'tasks.aufgabe', modul: 'tasks', bereich: null, rang: null, bestand: {leser: 'tasks', umfang: 'mandant'}},
] as const satisfies readonly TagQuelle[];
