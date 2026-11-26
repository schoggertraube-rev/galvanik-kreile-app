import type {TagQuelle} from '@/lib/today/todaySourceRegistry';

export const tagQuellen = [
  {id: 'fundament.firma', modul: 'fundament', bereich: null, rang: null, bestand: {leser: 'company', umfang: 'mandant'}},
] as const satisfies readonly TagQuelle[];
