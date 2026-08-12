/**
 * src/lib/auth-errors.ts
 *
 * Mapeo de errores crudos de Supabase Auth a mensajes amigables en español.
 * Usa coincidencia parcial con .includes() en minúsculas para tolerar
 * variaciones menores entre versiones del SDK (@supabase/supabase-js 2.111.0).
 */

export function getAuthErrorMessage(error: unknown): string {
  // Extraer el mensaje crudo del error de forma segura
  let raw = "";
  if (error && typeof error === "object" && "message" in error) {
    raw = String((error as { message: unknown }).message).toLowerCase();
  } else if (typeof error === "string") {
    raw = error.toLowerCase();
  }

  if (!raw) {
    return "Ocurrió un error inesperado. Intenta de nuevo.";
  }

  // Credenciales inválidas (caso más frecuente en login)
  if (raw.includes("invalid login credentials") || raw.includes("invalid credentials")) {
    return "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.";
  }

  // Correo sin confirmar
  if (raw.includes("email not confirmed")) {
    return "Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada (y spam) para confirmar tu cuenta.";
  }

  // Usuario ya registrado
  if (raw.includes("user already registered") || raw.includes("already been registered")) {
    return "Ya existe una cuenta con este correo. Intenta iniciar sesión en su lugar.";
  }

  // Contraseña muy corta
  if (raw.includes("password should be at least") || raw.includes("password must be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  // Formato de email inválido
  if (
    raw.includes("unable to validate email address") ||
    raw.includes("invalid email") ||
    raw.includes("email address is invalid")
  ) {
    return "El formato del correo electrónico no es válido.";
  }

  // Rate limit / demasiados intentos
  if (
    raw.includes("too many requests") ||
    raw.includes("rate limit") ||
    raw.includes("email rate limit") ||
    raw.includes("for security purposes")
  ) {
    return "Demasiados intentos. Espera unos minutos antes de volver a intentar.";
  }

  // Fallback: devolver el mensaje original si existe
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message) || "Ocurrió un error inesperado. Intenta de nuevo.";
  }

  return "Ocurrió un error inesperado. Intenta de nuevo.";
}
