/**
 * database.types.ts
 *
 * Tipos TypeScript manuales alineados con supabase/migrations/0001_initial_schema.sql
 *
 * NOTA: Una vez que tengas Supabase CLI configurado, puedes regenerar estos tipos
 * con el comando:
 *   npx supabase gen types typescript --project-id <tu-project-id> > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================
// ENUMS
// ============================================

export type ProspectStatus =
  | "nuevo"
  | "contactado"
  | "en_conversacion"
  | "propuesta_enviada"
  | "cerrado_ganado"
  | "cerrado_perdido";

export type ScoreTier = "verde" | "amarillo" | "rojo";

export type MessageChannel = "whatsapp" | "email" | "llamada";

export type ObjectionType = "precio" | "tiempo" | "competencia" | "otro";

export type SearchStatus = "pendiente" | "procesando" | "completado" | "error";

// ============================================
// ROW TYPES (registros tal como vienen de la DB)
// ============================================

export interface ProfileRow {
  id: string;
  sector: string | null;
  sector_personalizado: string | null;
  descripcion: string | null;
  sitio_web: string | null;
  portafolio_url: string | null;
  precio_promedio: number | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  ventajas: Json; // string[]
  icp: Json; // { tamano?: string; zona?: string; necesidades?: string }
  diagnostico_ia: Json; // { diagnostico_propuesta: string, oportunidades: string, sugerencias: string }
  onboarding_completado: boolean;
  credits_remaining: number;
  created_at: string;
  updated_at: string;
}

export interface SearchRow {
  id: string;
  user_id: string;
  query: string;
  ubicacion: string | null;
  status: SearchStatus;
  total_resultados: number;
  results_json: Json;
  error_mensaje: string | null;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  created_at: string;
  updated_at: string;
}


export interface ProspectRow {
  id: string;
  user_id: string;
  search_id: string | null;
  nombre_empresa: string;
  telefono: string | null;
  whatsapp: string | null;
  sitio_web: string | null;
  email: string | null;
  direccion: string | null;
  calificacion_google: number | null;
  num_resenas: number | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  status: ProspectStatus;
  created_at: string;
  updated_at: string;
}



export interface AuditRow {
  id: string;
  prospect_id: string;
  user_id: string;
  score: number | null; // 1-10
  tier: ScoreTier | null;
  puntos_dolor: Json; // string[]
  markdown_crudo: string | null;
  resumen_ia: string | null;
  analizado_at: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  prospect_id: string;
  user_id: string;
  canal: MessageChannel;
  contenido: string;
  variante: string | null;
  enviado: boolean;
  created_at: string;
}

export interface ObjectionRow {
  id: string;
  prospect_id: string;
  user_id: string;
  tipo: ObjectionType | null;
  texto_objecion: string;
  respuestas_sugeridas: Json; // Array<{ enfoque: string; texto: string }>
  created_at: string;
}

export interface FollowUpRow {
  id: string;
  prospect_id: string;
  user_id: string;
  fecha_vencimiento: string; // date as ISO string
  tipo: string | null;
  completado: boolean;
  created_at: string;
}

// ============================================
// INSERT TYPES (campos requeridos para insertar)
// Los campos con DEFAULT en DB son opcionales aquí
// ============================================

export type ProfileInsert = Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">> & {
  id: string;
};

export type SearchInsert = {
  id?: string;
  user_id: string;
  query: string;
  ubicacion?: string | null;
  status?: SearchStatus;
  total_resultados?: number | null;
  error_mensaje?: string | null;
};

export type ProspectInsert = {
  id?: string;
  user_id: string;
  search_id?: string | null;
  nombre_empresa: string;
  telefono?: string | null;
  whatsapp?: string | null;
  sitio_web?: string | null;
  email?: string | null;
  direccion?: string | null;
  calificacion_google?: number | null;
  num_resenas?: number | null;
  status?: ProspectStatus;
};

export type AuditInsert = {
  id?: string;
  prospect_id: string;
  user_id: string;
  score?: number | null;
  tier?: ScoreTier | null;
  puntos_dolor?: Json;
  markdown_crudo?: string | null;
  resumen_ia?: string | null;
  analizado_at?: string | null;
};

export type MessageInsert = {
  id?: string;
  prospect_id: string;
  user_id: string;
  canal: MessageChannel;
  contenido: string;
  variante?: string | null;
  enviado?: boolean;
};

export type ObjectionInsert = {
  id?: string;
  prospect_id: string;
  user_id: string;
  tipo?: ObjectionType | null;
  texto_objecion: string;
  respuestas_sugeridas?: Json;
};

export type FollowUpInsert = {
  id?: string;
  prospect_id: string;
  user_id: string;
  fecha_vencimiento: string;
  tipo?: string | null;
  completado?: boolean;
};

// ============================================
// UPDATE TYPES (todos los campos opcionales)
// ============================================

export type ProfileUpdate = Partial<Omit<ProfileRow, "id" | "created_at">>;
export type SearchUpdate = Partial<Omit<SearchRow, "id" | "user_id" | "created_at">>;
export type ProspectUpdate = Partial<Omit<ProspectRow, "id" | "user_id" | "created_at">>;
export type AuditUpdate = Partial<Omit<AuditRow, "id" | "prospect_id" | "user_id" | "created_at">>;
export type MessageUpdate = Partial<Omit<MessageRow, "id" | "prospect_id" | "user_id" | "created_at">>;
export type FollowUpUpdate = Partial<Omit<FollowUpRow, "id" | "prospect_id" | "user_id" | "created_at">>;

// ============================================
// SUPABASE DATABASE SHAPE (compatible con createClient<Database>)
// ============================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      searches: {
        Row: SearchRow;
        Insert: SearchInsert;
        Update: SearchUpdate;
        Relationships: [];
      };
      prospects: {
        Row: ProspectRow;
        Insert: ProspectInsert;
        Update: ProspectUpdate;
        Relationships: [];
      };
      audits: {
        Row: AuditRow;
        Insert: AuditInsert;
        Update: AuditUpdate;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: MessageInsert;
        Update: MessageUpdate;
        Relationships: [];
      };
      objections: {
        Row: ObjectionRow;
        Insert: ObjectionInsert;
        Update: Partial<Omit<ObjectionRow, "id" | "prospect_id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      follow_ups: {
        Row: FollowUpRow;
        Insert: FollowUpInsert;
        Update: FollowUpUpdate;
        Relationships: [];
      };
    };
    Enums: {
      prospect_status: ProspectStatus;
      score_tier: ScoreTier;
      message_channel: MessageChannel;
      objection_type: ObjectionType;
      search_status: SearchStatus;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
