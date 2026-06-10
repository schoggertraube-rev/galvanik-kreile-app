// supabase/functions/email-webhook/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  // Manual HMAC verification of Resend webhook signature
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';
  const signature = req.headers.get('svix-signature') ?? '';
  const timestamp = req.headers.get('svix-timestamp') ?? '';
  const msgId = req.headers.get('svix-id') ?? '';
  const rawBody = await req.text();

  if (!webhookSecret || !signature) {
    return new Response('Unauthorized', { status: 401 });
  }

  const signedContent = `${msgId}.${timestamp}.${rawBody}`;
  const secretBytes = webhookSecret.startsWith('whsec_')
    ? webhookSecret.slice(6)
    : webhookSecret;

  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(secretBytes), c => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));
  const expectedSigs = signature.split(' ').map(s => s.split(',')[1]);
  const valid = expectedSigs.some(s => s === computed);

  if (!valid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const event = payload.type; // e.g. "email.delivered", "email.bounced", "email.opened"
  const data = payload.data ?? {};
  const messageId = data.id;
  let statusUpdate: string | null = null;
  if (event === "email.delivered") statusUpdate = "delivered";
  else if (event === "email.bounced") statusUpdate = "bounced";
  else if (event === "email.opened") statusUpdate = "opened";
  if (statusUpdate && messageId) {
    await supabase
      .from("communications")
      .update({ status: statusUpdate })
      .eq("resend_message_id", messageId);
  }
  return new Response(JSON.stringify({ received: true }));
});
