'use server';

import { createClient } from '@/lib/supabase/server';

export async function saveShipmentInfo(params: {
  orderId: string;
  carrier: string;
  trackingNumber: string | null;
}) {
  const supabase = await createClient();
  const { orderId, carrier, trackingNumber } = params;

  // Insert or Update shipment
  const { error: shipmentErr } = await supabase
    .from('shipments')
    .upsert(
      { 
        tenant_id: 'galvanik-kreile',
        order_id: orderId, 
        carrier, 
        tracking_number: trackingNumber,
        status: 'pending'
      },
      { onConflict: 'order_id' }
    );

  if (shipmentErr) return { success: false, error: shipmentErr.message };

  // Update order delivery method
  const { error: orderErr } = await supabase
    .from('orders')
    .update({ delivery_method: carrier })
    .eq('id', orderId);

  if (orderErr) return { success: false, error: orderErr.message };

  return { success: true };
}

export async function sendShippingConfirmation(params: {
  orderId: string;
  carrier: string;
  trackingNumber: string | null;
}) {
  const supabase = await createClient();
  const { orderId, carrier, trackingNumber } = params;

  // 1. Update order status and shipment status
  await supabase.from('orders').update({ status: 'shipped' }).eq('id', orderId);
  await supabase.from('shipments').update({ status: 'shipped', shipped_at: new Date().toISOString() }).eq('order_id', orderId);

  // 2. Log event
  await supabase.from('events').insert({
    tenant_id: 'galvanik-kreile',
    order_id: orderId,
    event_type: 'SHIPPED',
    description: `Versand via ${carrier}${trackingNumber ? ' (' + trackingNumber + ')' : ''}`,
  });

  // 3. Queue email (Mocked for now since resend is external)
  await supabase.from('communication_messages').insert({
    tenant_id: 'galvanik-kreile',
    order_id: orderId,
    direction: 'outbound',
    channel: 'email',
    template_name: 'versandbereit',
    subject: 'Ihr Auftrag ist auf dem Weg',
    status: 'sent'
  });

  return { success: true };
}
