import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDashboardSummary } from "@/lib/analytics-service";
import { parseDashboardFilters } from "@/lib/request-parsers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseDashboardFilters(searchParams);
    const summary = await getDashboardSummary(filters);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to load summary";
    const status = message === "Dataset not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
