import { NextResponse } from "next/server";
import { ingestRosterDataset } from "@/lib/upload-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const semesterLabel = String(form.get("semesterLabel") || "").trim();
    const file = form.get("file");

    if (!semesterLabel) {
      return NextResponse.json({ error: "semesterLabel is required" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (
      !validTypes.includes(file.type) &&
      !/\.(csv|xlsx|xls)$/i.test(file.name)
    ) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload CSV/XLS/XLSX." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataset = await ingestRosterDataset({
      fileName: file.name,
      mimeType: file.type,
      semesterLabel,
      fileBuffer: buffer
    });

    return NextResponse.json(
      {
        dataset: {
          id: dataset.id,
          semesterLabel: dataset.semesterLabel,
          rowCount: dataset.rowCount
        }
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
