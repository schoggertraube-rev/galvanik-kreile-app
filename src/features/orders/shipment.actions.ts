'use server';

import { createClient } from '@/lib/supabase/server';

export async function saveShipmentInfo(params: {
  orderId: string;
  carrier: string;
  trackingNumber: string | null;
}) {
  const supabase = await createClient();
  const { orderId, carrier, trackingNumber } = params;

  if (carrier !== 'selbstabholung') {
    // Check customer address
    const { data: orderData, error: orderFetchErr } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('id', orderId)
      .single();

    if (orderFetchErr || !orderData?.customer_id) {
      return { success: false, error: 'Auftrag oder Kunde nicht gefunden' };
    }

    const { data: customerData, error: customerFetchErr } = await supabase
      .from('customers')
      .select('street, zip_code, city, country')
      .eq('id', orderData.customer_id)
      .single();

    if (customerFetchErr || !customerData) {
      return { success: false, error: 'Kunde nicht gefunden' };
    }

    const hasStreet = Boolean(customerData.street && customerData.street.trim().length > 0);
    const hasHouseNumber = Boolean(customerData.street && /\d/.test(customerData.street));
    const hasZipCode = Boolean(customerData.zip_code && customerData.zip_code.trim().length >= 4);
    const hasCity = Boolean(customerData.city && customerData.city.trim().length > 0);
    const hasCountry = Boolean(customerData.country && customerData.country.trim().length > 0);

    const isComplete = hasStreet && hasHouseNumber && hasZipCode && hasCity && hasCountry;

    if (!isComplete) {
      const missingFields = [];
      if (!hasStreet) missingFields.push('Straße');
      if (!hasHouseNumber) missingFields.push('Hausnummer');
      if (!hasZipCode) missingFields.push('PLZ');
      if (!hasCity) missingFields.push('Ort');
      if (!hasCountry) missingFields.push('Land');

      return {
        success: false,
        error: 'Unvollständige Versandadresse',
        missingFields,
        canChoosePickup: true,
        canEnterAlternativeAddress: true,
      };
    }
  }

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
