import type {TagQuelle} from '@/lib/today/todaySourceRegistry';

export const tagQuellen = [
  {id: 'orders.auftrag', modul: 'orders', bereich: null, rang: null, bestand: {leser: 'order', umfang: 'auftrag'}},
  {id: 'orders.liste', modul: 'orders', bereich: null, rang: null, bestand: {leser: 'orders', umfang: 'mandant'}},
] as const satisfies readonly TagQuelle[];
