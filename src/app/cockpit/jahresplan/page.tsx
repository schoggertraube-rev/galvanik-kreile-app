import { JahresplanClient } from "./JahresplanClient";
import { createClient } from "@/lib/supabase/server";

export default async function JahresplanPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const role = session?.user?.user_metadata?.role;
  const isDevOrAdmin = role === 'developer' || role === 'admin' || role === 'inhaber';

  return <JahresplanClient isDevOrAdmin={isDevOrAdmin} />;
}
