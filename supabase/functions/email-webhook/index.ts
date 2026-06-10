// supabase/functions/email-webhook/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySignature } from "https://deno.land/x/svix@0.1.5/mod.ts"; // Svix for signature verification

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const signature = req.headers.get("svix-signature") ?? "";
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    return new Response("Missing RESEND_WEBHOOK_SECRET", { status: 500 });
  }
  const rawBody = await req.text();
  try {
    verifySignature(secret, rawBody, signature);
  } catch (e) {
    console.error("Invalid webhook signature", e);
    return new Response("Invalid signature", { status: 401 });
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
