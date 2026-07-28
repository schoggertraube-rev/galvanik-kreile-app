import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { amountEur, description, orderId, customerId, metadata } = await req.json();
    const mollieApiKey = Deno.env.get('MOLLIE_API_KEY');
    const webhookBaseUrl = Deno.env.get('MOLLIE_WEBHOOK_BASE_URL'); // e.g. https://<project>.supabase.co/functions/v1/mollie-webhook

    if (!mollieApiKey) throw new Error("MOLLIE_API_KEY is not set");

    // Create payment in Mollie
    const molliePayload = {
      amount: {
        currency: 'EUR',
        value: Number(amountEur).toFixed(2), // Mollie requires string format "10.00"
      },
      description: description,
      redirectUrl: `${Deno.env.get('APP_BASE_URL') || 'http://localhost:3000'}/orders/${orderId}?payment=success`,
      webhookUrl: webhookBaseUrl,
      metadata: { orderId, customerId, ...metadata }
    };

    const res = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mollieApiKey}`
      },
      body: JSON.stringify(molliePayload)
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error("Mollie API Error:", resData);
      throw new Error(`Mollie Error: ${resData.detail}`);
    }

    const intentId = resData.id;
    const checkoutUrl = resData._links.checkout.href;

    // Log payment in DB
    const { error: dbError } = await supabase.from('payments').insert({
      tenant_id: 'galvanik-kreile',
      order_id: orderId,
      amount_eur: amountEur,
      status: 'pending',
      provider: 'mollie',
      provider_intent_id: intentId,
      mollie_status: resData.status,
    });

    if (dbError) {
      console.error("Error logging payment:", dbError);
    }

    return new Response(
      JSON.stringify({ success: true, intentId, checkoutUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: unknown) {
    console.error("Invoke Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unbekannter Fehler" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
