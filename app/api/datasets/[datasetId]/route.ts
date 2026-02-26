import { NextResponse } from "next/server";
import { deleteDatasetById, renameDatasetById } from "@/lib/analytics-service";

export async function DELETE(
  _request: Request,
  context: { params: { datasetId: string } }
) {
  try {
    const datasetId = context.params.datasetId?.trim();
    if (!datasetId) {
      return NextResponse.json({ error: "datasetId is required" }, { status: 400 });
    }

    const deleted = await deleteDatasetById(datasetId);
    return NextResponse.json({
      deleted,
      message: `Deleted ${deleted.semesterLabel} and all associated student records.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete dataset";
    const status = message === "Dataset not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: { datasetId: string } }
) {
  try {
    const datasetId = context.params.datasetId?.trim();
    if (!datasetId) {
      return NextResponse.json({ error: "datasetId is required" }, { status: 400 });
    }

    const body = (await request.json()) as { semesterLabel?: string };
    const semesterLabel = body.semesterLabel?.trim();
    if (!semesterLabel) {
      return NextResponse.json({ error: "semesterLabel is required" }, { status: 400 });
    }

    const updated = await renameDatasetById(datasetId, semesterLabel);
    return NextResponse.json({
      dataset: updated,
      message: `Updated semester name to ${updated.semesterLabel}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update dataset";
    const status = message === "Dataset not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
