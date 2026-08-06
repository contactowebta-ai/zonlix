import { redirect } from "next/navigation";

/**
 * Página raíz — redirige al dashboard o al login.
 * El middleware se encarga de proteger las rutas del dashboard.
 */
export default function RootPage() {
  redirect("/onboarding");
}
