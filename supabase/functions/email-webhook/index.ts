import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Basic webhook signature verification would go here using RESEND_WEBHOOK_SECRET
    // Currently skipping strict verification for demo/MVP

    const payload = await req.json();
    const type = payload.type; // e.g., 'email.delivered', 'email.bounced'
    const data = payload.data;
    const messageId = data?.email_id;

    if (!messageId) {
      return new Response("No message ID", { status: 400 });
    }

    let status = 'queued';
    const updateData: any = {};

    if (type === 'email.delivered') {
      status = 'delivered';
      updateData.status = status;
    } else if (type === 'email.opened') {
      updateData.opened_at = new Date().toISOString();
    } else if (type === 'email.bounced') {
      status = 'bounced';
      updateData.status = status;
      updateData.bounced_at = new Date().toISOString();
    } else if (type === 'email.complained') {
      status = 'complained';
      updateData.status = status;
      updateData.complained_at = new Date().toISOString();
    } else {
      return new Response("Ignored", { status: 200 });
    }

    const { error } = await supabase
      .from('communications')
      .update(updateData)
      .eq('resend_message_id', messageId);

    if (error) {
      console.error("Error updating communications:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
