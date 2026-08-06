/**
 * src/lib/supabase/client.ts
 *
 * Cliente de Supabase para Client Components ('use client').
 * Usa createBrowserClient de @supabase/ssr para manejar cookies correctamente
 * en el browser sin acceder a localStorage.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
