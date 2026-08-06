/**
 * src/lib/supabase/middleware.ts
 *
 * Helper para refrescar la sesión de Supabase en el middleware de Next.js.
 * Actualiza la cookie de sesión en la respuesta para que no expire durante
 * la navegación del usuario.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca la sesión — IMPORTANTE: no remover esta llamada.
  // Verifica si hay un usuario autenticado y refresca el token si es necesario.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas protegidas: redirige a /login si no hay sesión
  const protectedPaths = [
    "/onboarding",
    "/buscar",
    "/prospectos",
    "/crm",
  ];

  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Redirige usuarios autenticados fuera de las páginas auth
  const authPaths = ["/login", "/signup"];
  const isAuthPage = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isAuthPage && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/onboarding";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
