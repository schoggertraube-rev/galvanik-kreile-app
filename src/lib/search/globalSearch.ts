// src/lib/search/globalSearch.ts

import { supabase } from '@/lib/supabase/client';

/**
 * Perform a global search across orders and items.
 * Returns an array of result objects with type, id, label and sub.
 */
export async function globalSearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return [];

  // Search orders
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, title, status, customer_id, customers(first_name, last_name, company_name)')
    .or(`order_number.ilike.%${q}%,title.ilike.%${q}%`)
    .limit(10);

  // Search items
  const { data: itemData, error: itemError } = await supabase
    .from('items')
    .select('id, name, order_id, material, surface_requested')
    .or(`name.ilike.%${q}%,material.ilike.%${q}%`)
    .limit(5);

  // Map results
  const results = [];
  if (orderData) {
    results.push(
      ...orderData.map((o: any) => ({
        type: 'order',
        id: o.id,
        label: `${o.order_number} · ${o.title}`,
        sub: o.status,
      }))
    );
  }
  if (itemData) {
    results.push(
      ...itemData.map((i: any) => ({
        type: 'item',
        id: i.order_id,
        label: i.name,
        sub: i.material,
      }))
    );
  }

  return results;
}
