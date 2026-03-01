import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDashboardRecordsForExport } from "@/lib/analytics-service";
import { parseRecordsExportParams } from "@/lib/request-parsers";

function escapeCsvValue(value: string | number | null | undefined) {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = parseRecordsExportParams(searchParams);
    const rows = await getDashboardRecordsForExport(query);

    const header = [
      "Panther ID",
      "First Name",
      "Last Name",
      "Full Name",
      "GPA",
      "Major",
      "Campus",
      "Class Standing",
      "Student Type"
    ];

    const lines = [header.join(",")];
    for (const row of rows) {
      lines.push(
        [
          row.pantherId,
          row.firstName,
          row.lastName,
          row.fullName,
          row.gpa,
          row.majorDescription,
          row.campus,
          row.classStanding,
          row.studentType
        ]
          .map(escapeCsvValue)
          .join(",")
      );
    }

    const fileName = `honors-records-${query.datasetId}.csv`;
    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to export records";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
