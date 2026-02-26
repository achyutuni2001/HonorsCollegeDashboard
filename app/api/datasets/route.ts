import { NextResponse } from "next/server";
import { listDatasets } from "@/lib/analytics-service";

export async function GET() {
  const datasets = await listDatasets();
  return NextResponse.json(datasets);
}
