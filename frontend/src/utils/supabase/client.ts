import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/utils/supabase/config";

export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}
