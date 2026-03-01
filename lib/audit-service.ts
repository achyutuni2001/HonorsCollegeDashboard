import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents } from "@/db/schema";

type AuditAction = "UPLOAD" | "RENAME" | "DELETE";
type AuditRole = "admin" | "viewer";

export async function logAuditEvent(input: {
  datasetId?: string | null;
  action: AuditAction;
  actorName: string;
  actorRole: AuditRole;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditEvents).values({
    datasetId: input.datasetId ?? null,
    action: input.action,
    actorName: input.actorName,
    actorRole: input.actorRole,
    details: input.details ?? {}
  });
}

export async function listAuditEvents(datasetId?: string) {
  const rows = await db
    .select({
      id: auditEvents.id,
      datasetId: auditEvents.datasetId,
      action: auditEvents.action,
      actorName: auditEvents.actorName,
      actorRole: auditEvents.actorRole,
      details: auditEvents.details,
      createdAt: auditEvents.createdAt
    })
    .from(auditEvents)
    .where(datasetId ? eq(auditEvents.datasetId, datasetId) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: String(row.id),
    datasetId: row.datasetId,
    action: row.action,
    actorName: row.actorName,
    actorRole: row.actorRole,
    details: row.details,
    createdAt: new Date(row.createdAt).toISOString()
  }));
}
