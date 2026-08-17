import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { notAvailableResponse } from "../_shared/notAvailable.ts";

serve(() => notAvailableResponse());
