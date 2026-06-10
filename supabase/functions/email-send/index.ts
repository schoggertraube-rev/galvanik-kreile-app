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

    const { to, templateKey, variables, orderId, customerId } = await req.json();
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('EMAIL_FROM_DEFAULT') || "Galvanik Kreile <status@mail.kreile.de>";

    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    // 1. Load template from DB
    const { data: template, error: tplError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', templateKey)
      .single();

    if (tplError || !template) {
      throw new Error(`Template ${templateKey} not found`);
    }

    // 2. Replace variables in template
    let subject = template.subject_template;
    let html = template.body_html_template;
    
    for (const [key, value] of Object.entries(variables || {})) {
      const regex = new RegExp(`{${key}}`, 'g');
      subject = subject.replace(regex, String(value));
      html = html.replace(regex, String(value));
    }

    // 3. Send via Resend HTTP API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: html
      })
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error("Resend API Error:", resData);
      throw new Error(`Resend Error: ${resData.message}`);
    }

    // 4. Log in communications table
    const { error: commError } = await supabase.from('communications').insert({
      tenant_id: 'galvanik-kreile',
      customer_id: customerId,
      order_id: orderId,
      subject: subject,
      body: html,
      type: 'email',
      channel_type: 'resend',
      resend_message_id: resData.id,
      status: 'queued'
    });

    if (commError) {
      console.error("Error logging communication:", commError);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: resData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: any) {
    console.error("Invoke Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
