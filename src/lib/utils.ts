import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js'

/**
 * Combina clases de Tailwind de forma inteligente, resolviendo conflictos.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda en pesos mexicanos.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount)
}

/**
 * Formatea una fecha ISO a formato legible en español.
 */
export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString))
}

/**
 * Formatea una fecha ISO a formato corto.
 */
export function formatDateShort(dateString: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateString))
}

/**
 * Trunca un texto a n caracteres con elipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "…"
}

/**
 * Extrae el mensaje de un error desconocido de forma segura.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Ha ocurrido un error inesperado"
}

/**
 * Construye la URL de WhatsApp para un número de teléfono y mensaje dados.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, "")
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`
}

/**
 * Parsea un número de teléfono y devuelve información sobre si es móvil o fijo.
 */
export function getPhoneInfo(phoneNumber: string, country: CountryCode = 'MX') {
  if (!phoneNumber) return { cleanNumber: '', formattedNumber: '', isMobile: false, isFixed: false };
  
  const parsed = parsePhoneNumberFromString(phoneNumber, country);
  const cleanNumber = phoneNumber.replace(/\D/g, "");
  
  if (!parsed || !parsed.isValid()) {
    return { cleanNumber, formattedNumber: phoneNumber, isMobile: true, isFixed: false }; // Por defecto asumimos móvil si no sabemos
  }

  const type = parsed.getType();
  const isMobile = type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE';
  const isFixed = type === 'FIXED_LINE';
  
  return {
    cleanNumber: parsed.format('E.164').replace('+', ''), // E.g., 524422112233
    formattedNumber: parsed.formatInternational(),
    isMobile,
    isFixed
  };
}

/**
 * Mapeo de colores para el tier de score.
 */
export const tierColors = {
  verde: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  amarillo: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  rojo: "bg-rose-500/15 text-rose-400 border-rose-500/30",
} as const

/**
 * Mapeo de colores para el estado del prospecto.
 */
export const prospectStatusColors: Record<string, string> = {
  nuevo: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  contactado: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  en_conversacion: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  propuesta_enviada: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  cerrado_ganado: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cerrado_perdido: "bg-rose-500/15 text-rose-400 border-rose-500/30",
}

/**
 * Etiquetas legibles para estados del prospecto.
 */
export const prospectStatusLabels: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  en_conversacion: "En conversación",
  propuesta_enviada: "Propuesta enviada",
  cerrado_ganado: "Cerrado (ganado)",
  cerrado_perdido: "Cerrado (perdido)",
}
