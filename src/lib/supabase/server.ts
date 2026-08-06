/**
 * src/lib/supabase/server.ts
 *
 * Cliente de Supabase para Server Components, Route Handlers y Server Functions.
 * Usa createServerClient de @supabase/ssr con cookies de next/headers.
 *
 * IMPORTANTE: cookies() es async en Next.js 16 — siempre se usa con await.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll puede lanzar en Server Components de solo lectura.
            // El middleware se encarga de refrescar la sesión en esos casos.
          }
        },
      },
    }
  );
}

/**
 * createServiceClient
 *
 * Cliente con Service Role Key para operaciones administrativas
 * que bypasean RLS (úsalo solo en Route Handlers seguros del servidor).
 */
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No se necesita persistir cookies con el service client
        },
      },
    }
  );
}
