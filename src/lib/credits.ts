/**
 * src/lib/credits.ts
 *
 * Fuente única de verdad para el cálculo de costos de créditos en Zonlix.
 * $500 MXN = 500 créditos (1 crédito ≈ $1 MXN).
 */

/**
 * Costo de auditoría básica: prospecto SIN sitio web.
 * La IA analiza solo datos duros de Google Maps (rating, reseñas, categoría).
 * No se realiza scraping con Firecrawl — procesamiento más ligero.
 */
export const AUDIT_CREDIT_COST_BASIC = 3;

/**
 * Costo de auditoría profunda: prospecto CON sitio web.
 * Se realiza scraping vía Firecrawl + análisis de markdown por Gemini.
 * Mayor consumo de APIs externas justifica el costo adicional.
 */
export const AUDIT_CREDIT_COST_DEEP = 5;

/**
 * Calcula el costo en créditos de una búsqueda de prospectos.
 * Modelo 1:1 — 1 crédito por cada lead nuevo extraído y deduplicado.
 * Solo se cobra por los leads efectivamente entregados, nunca por el límite solicitado.
 *
 * @param newLeadsCount - Número real de leads nuevos tras deduplicar contra el historial.
 * @returns Créditos a descontar (0 si no hay leads nuevos).
 */
export function calculateSearchCreditCost(newLeadsCount: number): number {
  if (newLeadsCount <= 0) return 0;
  return newLeadsCount;
}

/**
 * Calcula el costo escalonado de una auditoría de prospecto.
 * La presencia de sitio web determina si se activa el pipeline de Firecrawl.
 *
 * @param hasWebsite - true si el prospecto tiene sitio web a scrapear.
 * @returns AUDIT_CREDIT_COST_DEEP (5) con sitio web, AUDIT_CREDIT_COST_BASIC (3) sin él.
 */
export function calculateAuditCreditCost(hasWebsite: boolean): number {
  return hasWebsite ? AUDIT_CREDIT_COST_DEEP : AUDIT_CREDIT_COST_BASIC;
}
