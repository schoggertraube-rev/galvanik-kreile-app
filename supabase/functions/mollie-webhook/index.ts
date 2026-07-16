import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(() => new Response(JSON.stringify({
  error: "Gone",
  canonical: "payments-webhook-mollie",
}), {
  status: 410,
  headers: {
    "Content-Type": "application/json",
    "Deprecation": "true",
    "Sunset": "Wed, 15 Jul 2026 00:00:00 GMT",
  },
}));
