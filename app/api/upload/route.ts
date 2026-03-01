import { NextResponse } from "next/server";
import { ingestRosterDataset } from "@/lib/upload-service";
import { assertAdmin, getSessionActor } from "@/lib/access-control";
import { requireApiSession } from "@/lib/require-api-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request);
    const actor = await getSessionActor(session);
    assertAdmin(actor);

    const form = await request.formData();
    const primaryFile = form.get("file");
    const multiFiles = form.getAll("files");
    const fileCandidates = [
      ...(primaryFile instanceof File ? [primaryFile] : []),
      ...multiFiles.filter((value): value is File => value instanceof File)
    ];
    const files = fileCandidates.filter(
      (file, index, list) =>
        list.findIndex((f) => f.name === file.name && f.size === file.size) === index
    );

    if (!files.length) {
      return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
    }

    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    for (const file of files) {
      if (!validTypes.includes(file.type) && !/\.(csv|xlsx|xls)$/i.test(file.name)) {
        return NextResponse.json(
          { error: `Unsupported file type for "${file.name}". Upload CSV/XLS/XLSX.` },
          { status: 400 }
        );
      }
    }

    const uploaded: Array<{ id: string; semesterLabel: string; rowCount: number }> = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const dataset = await ingestRosterDataset({
        fileName: file.name,
        mimeType: file.type,
        fileBuffer: buffer,
        actorName: actor.name,
        actorRole: actor.role
      });
      uploaded.push(dataset);
    }
    const latest = uploaded[uploaded.length - 1];

    return NextResponse.json(
      {
        dataset: latest,
        datasets: uploaded,
        uploadedCount: uploaded.length
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status =
      message === "Authentication required" ? 401 : message === "Admin role required" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
