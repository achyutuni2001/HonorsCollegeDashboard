import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDashboardRecords } from "@/lib/analytics-service";
import { parseRecordsParams } from "@/lib/request-parsers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = parseRecordsParams(searchParams);
    const records = await getDashboardRecords(query);
    return NextResponse.json(records);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to load records";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
