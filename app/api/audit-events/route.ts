import { NextResponse } from "next/server";
import { listAuditEvents } from "@/lib/audit-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("datasetId")?.trim() || undefined;
  const events = await listAuditEvents(datasetId);
  return NextResponse.json(events);
}
