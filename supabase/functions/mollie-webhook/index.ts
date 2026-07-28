import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const mollieApiKey = Deno.env.get('MOLLIE_API_KEY');

    // Mollie webhook sends form-urlencoded data with id=tr_...
    const formData = await req.formData();
    const paymentId = formData.get('id');

    if (!paymentId || typeof paymentId !== 'string') {
      return new Response("No payment id", { status: 400 });
    }

    if (!mollieApiKey) throw new Error("MOLLIE_API_KEY missing");

    // Fetch payment status from Mollie
    const res = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mollieApiKey}`
      }
    });

    const paymentData = await res.json();

    if (!res.ok) {
      console.error("Mollie Webhook Fetch Error:", paymentData);
      return new Response("Error fetching payment from Mollie", { status: 500 });
    }

    const newMollieStatus = paymentData.status; // 'open', 'canceled', 'pending', 'expired', 'failed', 'paid'
    let newAppStatus = 'pending';
    if (newMollieStatus === 'paid') newAppStatus = 'completed';
    else if (['canceled', 'expired', 'failed'].includes(newMollieStatus)) newAppStatus = 'failed';

    const orderId = paymentData.metadata?.orderId;
    const amountEur = parseFloat(paymentData.amount.value);
    
    // Update payments table
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: newAppStatus,
        mollie_status: newMollieStatus,
        mollie_method: paymentData.method
      })
      .eq('provider_intent_id', paymentId);

    if (updateError) {
      console.error("Error updating payment in DB:", updateError);
    }

    // If paid, create invoice (Ausgangsrechnung) & send receipt email
    if (newMollieStatus === 'paid' && orderId) {
      // 1. Create Invoice
      const { data: invData, error: invError } = await supabase
        .from('ausgangsrechnung')
        .insert({
          nummer: `RE-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
          order_id: orderId,
          datum: new Date().toISOString().split('T')[0],
          brutto: amountEur,
          bezahlt_am: new Date().toISOString().split('T')[0],
          bezahlt_methode: paymentData.method,
          bezahlt_betrag_eur: amountEur,
          status: 'bezahlt'
        })
        .select('id')
        .single();

      // 2. Link payment to invoice
      if (invData?.id) {
        await supabase
          .from('ausgangsrechnung')
          .update({ bezahlt_payment_id: paymentId })
          .eq('id', invData.id);
      }

      // 3. Send email receipt using email-send function
      // Assuming customer details can be fetched
      const { data: order } = await supabase.from('orders').select('customer_id, customers(email)').eq('id', orderId).single();
      const customerEmail = order?.customers?.email;
      
      if (customerEmail) {
        await supabase.functions.invoke("email-send", {
          body: {
            to: customerEmail,
            templateKey: 'zahlung_quittung',
            variables: { order_id: orderId, amount: amountEur.toFixed(2) },
            orderId: orderId,
            customerId: order?.customer_id
          }
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err: unknown) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unbekannter Fehler" }), { status: 500 });
  }
});
