/**
 * src/types/index.ts
 * Re-exportaciones centralizadas de tipos y schemas.
 */

// Database types
export type {
  Json,
  Database,
  // Enums
  ProspectStatus,
  ScoreTier,
  MessageChannel,
  ObjectionType,
  SearchStatus,
  // Rows
  ProfileRow,
  SearchRow,
  ProspectRow,
  AuditRow,
  MessageRow,
  ObjectionRow,
  FollowUpRow,
  // Inserts
  ProfileInsert,
  SearchInsert,
  ProspectInsert,
  AuditInsert,
  MessageInsert,
  ObjectionInsert,
  FollowUpInsert,
  // Updates
  ProfileUpdate,
  SearchUpdate,
  ProspectUpdate,
  AuditUpdate,
  MessageUpdate,
  FollowUpUpdate,
} from "./database.types";

// Shared Action Result pattern
export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Zod schemas
export {
  prospectStatusSchema,
  scoreTierSchema,
  messageChannelSchema,
  objectionTypeSchema,
  searchStatusSchema,
  profileSchema,
  searchSchema,
  prospectSchema,
  prospectUpdateStatusSchema,
  auditSchema,
  messageSchema,
  messageGenerateSchema,
  objectionSchema,
  objectionResponseSchema,
  followUpSchema,
  paginationSchema,
  // Fase 2 & 3
  apifyWebhookPayloadSchema,
  apifyPlaceSchema,
  geminiAuditResponseSchema,
  geminiAgencyAuditSchema,
  geminiMessagesResponseSchema,
  createSearchSchema,
  auditJobSchema,
  profileFormSchema,
} from "./schemas";

// Zod-derived types
export type {
  ProfileInput,
  SearchInput,
  ProspectInput,
  AuditInput,
  MessageInput,
  MessageGenerateInput,
  ObjectionInput,
  FollowUpInput,
  PaginationInput,
  // Fase 2 & 3
  ApifyWebhookPayload,
  ApifyPlace,
  GeminiAuditResponse,
  GeminiAgencyAuditResponse,
  GeminiMessagesResponse,
  CreateSearchInput,
  AuditJobInput,
  ProfileFormInput,
  ObjectionResponseInput,
} from "./schemas";

