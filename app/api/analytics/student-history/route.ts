import { NextResponse } from "next/server";
import { z } from "zod";
import { getStudentHistory } from "@/lib/strategic-analytics-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pantherId = z.string().min(1).parse(searchParams.get("pantherId"));
    const history = await getStudentHistory(pantherId);
    if (!history) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    return NextResponse.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load student history";
    const status = message === "Student not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
