/**
 * src/lib/qstash.ts
 *
 * Cliente de Upstash QStash para colas y background jobs.
 */
import { Client as QStashClient } from "@upstash/qstash";

export const qstash = new QStashClient({
  token: process.env.QSTASH_TOKEN!,
});

/**
 * Signing keys para verificar webhooks de QStash en Route Handlers.
 * Usadas por verifySignatureAppRouter en /api/jobs/audit-prospect.
 */
export const qstashSigningKeys = {
  current: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  next: process.env.QSTASH_NEXT_SIGNING_KEY!,
};

// ============================================
// HELPERS DE PUBLICACIÓN
// ============================================

/**
 * Encola un job de auditoría individual para un prospecto.
 * QStash entregará el mensaje a /api/jobs/audit-prospect con firma verificable.
 *
 * @param prospectId - UUID del prospecto a auditar
 */
export async function enqueueAuditJob(prospectId: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  await qstash.publishJSON({
    url: `${appUrl}/api/jobs/audit-prospect`,
    body: { prospectId },
    // Reintento automático de QStash si el job falla (máx 3 intentos)
    retries: 3,
  });
}
