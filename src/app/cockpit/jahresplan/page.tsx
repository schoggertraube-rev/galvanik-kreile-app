import { JahresplanClient } from "./JahresplanClient";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/requireAuth";

export default async function JahresplanPage() {
  await requireAuth();
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const role = session?.user?.user_metadata?.role;
  const isDevOrAdmin = role === 'developer' || role === 'admin' || role === 'inhaber';

  return <JahresplanClient isDevOrAdmin={isDevOrAdmin} />;
}
