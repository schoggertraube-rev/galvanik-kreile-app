// supabase/functions/email-send/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const { templateKey, to, variables, orderId, customerId } = await req.json();
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response("Missing RESEND_API_KEY", { status: 500 });
  }
  // Fetch template from DB
  const { data: tmpl, error } = await supabase
    .from("email_templates")
    .select("subject, content")
    .eq("template_key", templateKey)
    .single();
  if (error || !tmpl) {
    return new Response(JSON.stringify({ error: error?.message ?? "Template not found" }), { status: 400 });
  }
  let html = tmpl.content;
  for (const [key, value] of Object.entries(variables ?? {})) {
    const placeholder = `{${key}}`;
    html = html.replaceAll(placeholder, String(value));
  }
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "no-reply@galvanik-kreile.de",
      to,
      subject: tmpl.subject,
      html,
    }),
  });
  const resendData = await resendRes.json();
  // Record communication
  await supabase.from("communications").insert({
    type: "email",
    order_id: orderId,
    customer_id: customerId,
    status: "sent",
    resend_message_id: resendData.id,
    direction: "out",
    created_at: new Date().toISOString(),
  });
  return new Response(JSON.stringify({ success: true, messageId: resendData.id }));
});
