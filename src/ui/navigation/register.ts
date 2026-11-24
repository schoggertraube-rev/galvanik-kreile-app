import type {IconName} from '../kr/Icon';
import {FUNDAMENT_NAVIGATION,FUNDAMENT_NAVIGATION_UNTEN} from './fundament';
import {EINGANG_NAVIGATION} from './eingang';
import {WERKSTATT_NAVIGATION} from './werkstatt';
import {ORDERS_NAVIGATION} from './orders';
import {CUSTOMERS_NAVIGATION} from './customers';
import {ACCOUNTING_NAVIGATION} from './accounting';
import {LAGER_NAVIGATION} from './lager';
import {COMPLAINTS_NAVIGATION} from './complaints';
import {QUOTES_NAVIGATION} from './quotes';
import {AUSGANG_NAVIGATION} from './ausgang';
import {KALENDER_NAVIGATION} from './kalender';

export type NavigationsEintrag = Readonly<{ id: string; text: string; icon: IconName; route: string; pfad: string | null; dockText: string | null; platz: 'liste' | 'unten' }>;
export const NAVIGATION = [...FUNDAMENT_NAVIGATION,...EINGANG_NAVIGATION,...WERKSTATT_NAVIGATION,...ORDERS_NAVIGATION,...CUSTOMERS_NAVIGATION,...ACCOUNTING_NAVIGATION,...LAGER_NAVIGATION,...COMPLAINTS_NAVIGATION,...QUOTES_NAVIGATION,...AUSGANG_NAVIGATION,...KALENDER_NAVIGATION,...FUNDAMENT_NAVIGATION_UNTEN] as const;
export type Bereich = typeof NAVIGATION[number]['id'];
