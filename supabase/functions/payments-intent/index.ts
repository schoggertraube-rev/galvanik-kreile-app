// supabase/functions/payments-intent/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const { orderId, amountEur, description, customerId, idempotencyKey } = await req.json();
  const mollieApiKey = Deno.env.get("MOLLIE_API_KEY");
  if (!mollieApiKey) {
    return new Response("Missing MOLLIE_API_KEY", { status: 500 });
  }
  // Create Mollie payment
  const mollieRes = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${mollieApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: { value: Number(amountEur).toFixed(2), currency: "EUR" },
      description,
      redirectUrl: `${Deno.env.get("APP_BASE_URL")}/payment/complete?orderId=${orderId}`,
      webhookUrl: `${Deno.env.get("APP_BASE_URL")}/api/payments/webhook/mollie`,
      metadata: { orderId, customerId },
      idempotencyKey,
    }),
  });
  const data = await mollieRes.json();
  // Store payment intent
  await supabase.from("payments").insert({
    tenant_id: "galvanik-kreile",
    order_id: orderId,
    amount_eur: amountEur,
    status: "pending",
    provider: "mollie",
    provider_intent_id: data.id,
    metadata: data.metadata,
    created_at: new Date().toISOString(),
  });
  return new Response(JSON.stringify({ checkoutUrl: data._links.checkout.href, paymentId: data.id }));
});
