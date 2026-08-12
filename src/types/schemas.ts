/**
 * schemas.ts
 *
 * Zod schemas para validación de inputs en API Routes (Fase 2).
 * Reflejan cada tabla del schema SQL.
 */
import { z } from "zod";

// ============================================
// ENUMS
// ============================================

export const prospectStatusSchema = z.enum([
  "nuevo",
  "contactado",
  "en_conversacion",
  "propuesta_enviada",
  "cerrado_ganado",
  "cerrado_perdido",
]);

export const scoreTierSchema = z.enum(["verde", "amarillo", "rojo"]);

export const messageChannelSchema = z.enum(["whatsapp", "email", "llamada"]);

export const objectionTypeSchema = z.enum([
  "precio",
  "tiempo",
  "competencia",
  "otro",
]);

export const searchStatusSchema = z.enum([
  "pendiente",
  "procesando",
  "completado",
  "error",
]);

// ============================================
// PROFILE SCHEMA
// ============================================

export const profileSchema = z.object({
  sector: z.string().min(1, "El sector es requerido").max(200).optional(),
  sector_personalizado: z.string().max(200).optional().or(z.literal("")),
  descripcion: z
    .string()
    .min(10, "Mínimo 10 caracteres")
    .max(2000)
    .optional(),
  sitio_web: z.string().url("URL inválida").optional().or(z.literal("")),
  portafolio_url: z.string().url("URL inválida").optional().or(z.literal("")),
  precio_promedio: z
    .number()
    .positive("Debe ser un valor positivo")
    .optional(),
  linkedin_url: z.string().url("URL inválida").optional().or(z.literal("")),
  instagram_url: z.string().url("URL inválida").optional().or(z.literal("")),
  facebook_url: z.string().url("URL inválida").optional().or(z.literal("")),
  ventajas: z.array(z.string().max(200)).max(10).optional(),
  icp: z
    .object({
      tamano: z.string().optional(),
      zona: z.string().optional(),
      necesidades: z.string().optional(),
    })
    .optional(),
  onboarding_completado: z.boolean().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// ============================================
// SEARCH SCHEMA
// ============================================

export const searchSchema = z.object({
  query: z
    .string()
    .min(3, "La búsqueda debe tener al menos 3 caracteres")
    .max(500),
  ubicacion: z.string().max(200).optional(),
});

export type SearchInput = z.infer<typeof searchSchema>;

// ============================================
// PROSPECT SCHEMA
// ============================================

export const prospectSchema = z.object({
  search_id: z.string().uuid().optional().nullable(),
  nombre_empresa: z
    .string()
    .min(1, "El nombre de la empresa es requerido")
    .max(300),
  telefono: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  sitio_web: z.string().url("URL inválida").optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  calificacion_google: z.number().min(0).max(5).optional().nullable(),
  num_resenas: z.number().int().min(0).optional().nullable(),
  status: prospectStatusSchema.optional(),
});

export type ProspectInput = z.infer<typeof prospectSchema>;

export const prospectUpdateStatusSchema = z.object({
  status: prospectStatusSchema,
});

// ============================================
// AUDIT SCHEMA
// ============================================

export const auditSchema = z.object({
  prospect_id: z.string().uuid("ID de prospecto inválido"),
  score: z.number().int().min(1).max(10).optional().nullable(),
  tier: scoreTierSchema.optional().nullable(),
  puntos_dolor: z.array(z.string().max(500)).max(20).optional(),
  markdown_crudo: z.string().optional().nullable(),
  resumen_ia: z.string().max(5000).optional().nullable(),
  analizado_at: z.string().datetime().optional().nullable(),
});

export type AuditInput = z.infer<typeof auditSchema>;

// ============================================
// MESSAGE SCHEMA
// ============================================

export const messageSchema = z.object({
  prospect_id: z.string().uuid("ID de prospecto inválido"),
  canal: messageChannelSchema,
  contenido: z.string().min(1, "El contenido es requerido").max(10000),
  variante: z.string().max(100).optional().nullable(),
  enviado: z.boolean().optional(),
});

export type MessageInput = z.infer<typeof messageSchema>;

export const messageGenerateSchema = z.object({
  prospect_id: z.string().uuid(),
  canales: z.array(messageChannelSchema).min(1).max(3),
});

export type MessageGenerateInput = z.infer<typeof messageGenerateSchema>;

// ============================================
// OBJECTION SCHEMA
// ============================================

export const objectionItemSchema = z.object({
  enfoque: z.string(),
  texto: z.string(),
});

export type ObjectionItem = z.infer<typeof objectionItemSchema>;

export const objectionResponseSchema = z.object({
  respuestas: z.array(objectionItemSchema).min(2).max(3),
});

export type ObjectionResponseInput = z.infer<typeof objectionResponseSchema>;

export const objectionSchema = z.object({
  prospect_id: z.string().uuid("ID de prospecto inválido"),
  tipo: objectionTypeSchema.optional().nullable(),
  texto_objecion: z
    .string()
    .min(5, "Describe la objeción con al menos 5 caracteres")
    .max(2000),
  respuestas_sugeridas: z.array(objectionItemSchema).optional(),
});

export type ObjectionInput = z.infer<typeof objectionSchema>;


// ============================================
// FOLLOW-UP SCHEMA
// ============================================

export const followUpSchema = z.object({
  prospect_id: z.string().uuid("ID de prospecto inválido"),
  fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)"),
  tipo: z.string().max(100).optional().nullable(),
  completado: z.boolean().optional(),
});

export type FollowUpInput = z.infer<typeof followUpSchema>;

// ============================================
// PAGINATION SCHEMA (shared)
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ============================================
// FASE 2 — APIFY SCHEMAS
// ============================================

export const apifyWebhookPayloadSchema = z.object({
  eventType: z.string().optional(),
  searchId: z.string().optional(),
  datasetId: z.string().optional(),
  eventData: z
    .object({
      actorRunId: z.string().optional(),
      searchId: z.string().optional(),
      defaultDatasetId: z.string().optional(),
    })
    .passthrough()
    .optional(),
  resource: z
    .object({
      defaultDatasetId: z.string().optional(),
    })
    .passthrough()
    .optional(),
}).passthrough();


export type ApifyWebhookPayload = z.infer<typeof apifyWebhookPayloadSchema>;

/**
 * Una empresa cruda tal como la entrega el actor compass/crawler-google-places de Apify.
 * Usamos .passthrough() para conservar campos adicionales que el actor pueda devolver
 * (placeId, url, location, street, domain, etc.) y que necesitamos en el mapeo del webhook.
 */
export const apifyPlaceSchema = z.object({
  title: z.union([z.string(), z.number()]).optional().nullable(),
  name: z.union([z.string(), z.number()]).optional().nullable(),
  phone: z.union([z.string(), z.number()]).optional().nullable(),
  phoneUnformatted: z.union([z.string(), z.number()]).optional().nullable(),
  website: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  totalScore: z.union([z.number(), z.string()]).optional().nullable(),
  rating: z.union([z.number(), z.string()]).optional().nullable(),
  stars: z.union([z.number(), z.string()]).optional().nullable(),
  reviewsCount: z.union([z.number(), z.string()]).optional().nullable(),
  reviews_count: z.union([z.number(), z.string()]).optional().nullable(),
  reviews: z.union([z.number(), z.string()]).optional().nullable(),
  categoryName: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  placeId: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  googleMapsUrl: z.string().optional().nullable(),
  location: z.any().optional().nullable(),
  cid: z.string().optional().nullable(),
  en_crm: z.boolean().optional(),
}).passthrough();

export type ApifyPlace = z.infer<typeof apifyPlaceSchema>;


// ============================================
// FASE 2 — GEMINI SCHEMAS
// ============================================

export const geminiNormalizedSearchSchema = z.object({
  searchQuery: z.string(),
  wasCorrected: z.boolean(),
  searchLocation: z.string(),
  isLocationValid: z.boolean(),
  isValidCategory: z.boolean().default(true),
  countryCode: z.string().optional(),
});

export type GeminiNormalizedSearchResponse = z.infer<typeof geminiNormalizedSearchSchema>;

/**
 * Respuesta estructurada de Gemini para auditoría de presencia digital.
 * IMPORTANTE: score bajo = alta oportunidad (tier verde), score alto = baja oportunidad (tier rojo).
 */
export const geminiAuditResponseSchema = z.object({
  score: z.number().min(1).max(10),
  tier: z.enum(["verde", "amarillo", "rojo"]),
  puntos_dolor: z.array(z.string()).min(1).max(3),
  resumen_ia: z.string(),
});

export type GeminiAuditResponse = z.infer<typeof geminiAuditResponseSchema>;

/**
 * Respuesta estructurada de Gemini para auditoría del perfil de la agencia.
 */
export const geminiAgencyAuditSchema = z.object({
  diagnostico_propuesta: z.string(),
  oportunidades: z.string(),
  sugerencias: z.string(),
});

export type GeminiAgencyAuditResponse = z.infer<typeof geminiAgencyAuditSchema>;

/**
 * Respuesta estructurada de Gemini para mensajes de prospección por canal.
 */
export const geminiMessagesResponseSchema = z.object({
  whatsapp: z.string(),
  email: z.object({
    asunto: z.string(),
    cuerpo: z.string(),
  }),
  guion_telefonico: z.string(),
});

export type GeminiMessagesResponse = z.infer<typeof geminiMessagesResponseSchema>;

// ============================================
// FASE 2 — API INPUT SCHEMAS
// ============================================

/**
 * Body de entrada para POST /api/searches
 */
export const createSearchSchema = z.object({
  query: z.string()
    .min(3, "La búsqueda debe tener al menos 3 caracteres")
    .max(80, "La búsqueda no puede exceder los 80 caracteres")
    .regex(/^[a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑüÜ]+$/, "Caracteres no permitidos detectados. Solo se permiten letras, números y espacios."),
  ubicacion: z.string()
    .min(2, "La ubicación debe tener al menos 2 caracteres")
    .max(80, "La ubicación no puede exceder los 80 caracteres")
    .regex(/^[a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑüÜ]+$/, "Caracteres no permitidos detectados. Solo se permiten letras, números y espacios."),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type CreateSearchInput = z.infer<typeof createSearchSchema>;

export const auditJobSchema = z.object({
  prospectId: z.string().uuid(),
});


export type AuditJobInput = z.infer<typeof auditJobSchema>;

// ============================================
// FASE 3 — FORM & COPILOT SCHEMAS
// ============================================


export const profileFormSchema = z.object({
  sector: z.string().min(1, "Selecciona un sector"),
  sector_personalizado: z.string().max(200).optional().or(z.literal("")),
  descripcion: z.string().max(1000, "La descripción no puede superar los 1000 caracteres"),
  sitio_web: z.string().url("URL inválida").or(z.literal("")).optional(),
  portafolio_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  precio_promedio: z.coerce.number().min(0, "El precio debe ser mayor o igual a 0").optional(),
  /** Divisa del ticket promedio. Solo existe en frontend — no hay columna en DB, se persiste
   *  como contexto inyectado en los prompts de Gemini. Fallback defensivo: "MXN". */
  moneda: z.enum(["USD", "MXN", "COP", "CLP", "PEN", "ARS", "EUR"]).default("MXN"),
  linkedin_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  instagram_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  facebook_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  ventajas: z.array(z.string()).min(1, "Agrega al menos una ventaja").max(3, "Máximo 3 ventajas"),
  icp: z.object({
    tamano: z.string().optional(),
    zona: z.string().optional(),
    necesidades: z.string().optional(),
  }).optional(),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;


